#!/usr/bin/env python3
"""FastAPI service to generate order PDF and upload it to DigitalOcean Spaces."""

from __future__ import annotations

import logging
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import time
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any
from urllib.parse import urlparse

import boto3
import requests
from bson import ObjectId
from docx.shared import Mm
from docxtpl import DocxTemplate, InlineImage
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from pymongo import MongoClient


LOGGER = logging.getLogger("pdf_service")
WORD_CONVERSION_LOCK = threading.Lock()


@dataclass
class Config:
    mongo_url: str
    mongo_db: str
    template_path: Path
    output_docx_dir: Path
    output_pdf_dir: Path
    images_dir: Path
    spaces_access_key: str
    spaces_secret_key: str
    spaces_bucket: str
    spaces_region: str
    spaces_endpoint: str

    @staticmethod
    def from_env() -> "Config":
        load_dotenv()

        mongo_url = os.getenv("MONGODB_URL")
        mongo_db = os.getenv("MONGODB_DATABASE")
        spaces_access_key = os.getenv("DIGITALOCEAN_ACCESS_KEY")
        spaces_secret_key = os.getenv("DIGITALOCEAN_SPACES_SECRET_KEY") or os.getenv("DIGITALOCEAN_CLIENT_SECRET")
        spaces_bucket = os.getenv("DIGITALOCEAN_BUCKET_NAME")
        spaces_region = os.getenv("DIGITALOCEAN_SPACES_REGION")
        spaces_endpoint = os.getenv("DIGITALOCEAN_SPACES_ENDPOINT")

        missing = [
            key
            for key, value in [
                ("MONGODB_URL", mongo_url),
                ("MONGODB_DATABASE", mongo_db),
                ("DIGITALOCEAN_ACCESS_KEY", spaces_access_key),
                ("DIGITALOCEAN_SPACES_SECRET_KEY|DIGITALOCEAN_CLIENT_SECRET", spaces_secret_key),
                ("DIGITALOCEAN_BUCKET_NAME", spaces_bucket),
                ("DIGITALOCEAN_SPACES_REGION", spaces_region),
                ("DIGITALOCEAN_SPACES_ENDPOINT", spaces_endpoint),
            ]
            if not value
        ]
        if missing:
            raise ValueError(f"Missing required env variables: {', '.join(missing)}")

        return Config(
            mongo_url=mongo_url,
            mongo_db=mongo_db,
            template_path=Path("template.docx"),
            output_docx_dir=Path("output/docx"),
            output_pdf_dir=Path("output/pdf"),
            images_dir=Path("output/images"),
            spaces_access_key=spaces_access_key,
            spaces_secret_key=spaces_secret_key,
            spaces_bucket=spaces_bucket,
            spaces_region=spaces_region,
            spaces_endpoint=spaces_endpoint.rstrip("/"),
        )


class GeneratePdfRequest(BaseModel):
    order_id: str = Field(..., min_length=1)


def ensure_dirs(config: Config) -> None:
    config.output_docx_dir.mkdir(parents=True, exist_ok=True)
    config.output_pdf_dir.mkdir(parents=True, exist_ok=True)
    config.images_dir.mkdir(parents=True, exist_ok=True)


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "item"


def safe_object_id(value: Any) -> ObjectId | None:
    if isinstance(value, ObjectId):
        return value
    if isinstance(value, str):
        try:
            return ObjectId(value)
        except Exception:
            return None
    return None


def extract_user_name(user_doc: dict[str, Any] | None) -> str:
    if not user_doc:
        return "Customer"
    if user_doc.get("name"):
        return str(user_doc["name"]).strip()
    first_name = str(user_doc.get("firstName") or "").strip()
    last_name = str(user_doc.get("lastName") or "").strip()
    combined = f"{first_name} {last_name}".strip()
    return combined or "Customer"


def get_product_image_url(product_doc: dict[str, Any] | None) -> str | None:
    if not product_doc:
        return None
    image = product_doc.get("productImage")
    if isinstance(image, str) and image.strip():
        return image
    return None


def get_ingredient_names(ingredients_collection: Any, product_id: ObjectId) -> list[str]:
    ingredient_docs = ingredients_collection.find(
        {
            "products": product_id,
            "isDeleted": {"$ne": True},
        },
        {"name": 1},
    )

    names: list[str] = []
    for ing in ingredient_docs:
        name_obj = ing.get("name")
        name_en = None
        if isinstance(name_obj, dict):
            name_en = name_obj.get("en") or next((v for v in name_obj.values() if isinstance(v, str)), None)
        elif isinstance(name_obj, str):
            name_en = name_obj

        if name_en:
            clean_name = str(name_en).strip()
            if clean_name and clean_name not in names:
                names.append(clean_name)

    return names


def download_image(image_url: str, images_dir: Path) -> Path | None:
    normalized_url = str(image_url).strip().strip("\"'").replace("\n", "").replace("\r", "")
    if not normalized_url:
        return None

    try:
        response = requests.get(normalized_url, timeout=30)
        response.raise_for_status()
    except Exception as exc:
        LOGGER.warning("Failed to download image %s: %s", normalized_url, exc)
        return None

    suffix = Path(urlparse(normalized_url).path).suffix or ".png"
    with NamedTemporaryFile(delete=False, suffix=suffix, dir=images_dir) as temp_file:
        temp_file.write(response.content)
        return Path(temp_file.name)


def convert_docx_to_pdf(input_docx: Path, output_pdf: Path) -> bool:
    # Word COM automation is more reliable in a dedicated process than inside FastAPI threadpools.
    with WORD_CONVERSION_LOCK:
        for attempt in range(2):
            try:
                if output_pdf.exists():
                    output_pdf.unlink()

                conversion_cmd = [
                    sys.executable,
                    "-c",
                    (
                        "from docx2pdf import convert; "
                        f"convert(r'''{str(input_docx)}''', r'''{str(output_pdf)}''')"
                    ),
                ]
                subprocess.run(conversion_cmd, check=True, capture_output=True, text=True, timeout=180)
                if output_pdf.exists() and output_pdf.stat().st_size > 0:
                    return True
            except Exception as exc:
                LOGGER.warning(
                    "docx2pdf conversion failed for %s (attempt %d/2): %s",
                    input_docx,
                    attempt + 1,
                    exc,
                )
                time.sleep(1)

    soffice = shutil.which("soffice")
    if soffice:
        try:
            subprocess.run(
                [
                    soffice,
                    "--headless",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    str(output_pdf.parent),
                    str(input_docx),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            expected_pdf = output_pdf.parent / f"{input_docx.stem}.pdf"
            if expected_pdf.exists() and expected_pdf != output_pdf:
                expected_pdf.replace(output_pdf)
            return output_pdf.exists()
        except Exception as exc:
            LOGGER.debug("LibreOffice conversion failed for %s: %s", input_docx, exc)

    return False


def build_context_for_order(
    db: Any,
    order: dict[str, Any],
    template: DocxTemplate,
    images_dir: Path,
) -> dict[str, Any]:
    users_collection = db["users"]
    products_collection = db["products"]
    ingredients_collection = db["product_ingredients"]

    user_id = safe_object_id(order.get("userId"))
    user_doc = users_collection.find_one({"_id": user_id}) if user_id else None
    user_name = extract_user_name(user_doc)

    blend: list[dict[str, Any]] = []
    for item in order.get("items", []):
        product_id = safe_object_id(item.get("productId"))
        product_doc = products_collection.find_one({"_id": product_id}) if product_id else None
        ingredient_names = get_ingredient_names(ingredients_collection, product_id) if product_id else []

        image_url = get_product_image_url(product_doc)
        image_value: Any = ""
        if image_url:
            image_path = download_image(image_url, images_dir)
            if image_path:
                image_value = InlineImage(template, str(image_path), width=Mm(22))

        components = [{"name": n, "amount": "-", "perc": "-"} for n in ingredient_names]
        if not components:
            components = [{"name": "-", "amount": "-", "perc": "-"}]

        blend.append(
            {
                "name": item.get("name") or (str(product_doc.get("name")) if product_doc else "Unnamed Product"),
                "dose": item.get("capsuleCount") or item.get("durationDays") or "",
                "type": order.get("variantType") or "",
                "img": image_value,
                "components": components,
                "has_excepients": False,
                "excepients": "",
            }
        )

    created_at = order.get("createdAt")
    if isinstance(created_at, datetime):
        expiry_date = (created_at + timedelta(days=365)).strftime("%d-%m-%Y")
    else:
        expiry_date = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%d-%m-%Y")

    first_name = user_name.split()[0] if user_name else "Customer"

    return {
        "first_name": first_name,
        "sequence_type": f"Order {order.get('orderNumber', '')}".strip(),
        "expiry_date": expiry_date,
        "referral_code": order.get("couponCode") or order.get("orderNumber") or "",
        "blend": blend,
    }


def upload_pdf_to_spaces(config: Config, pdf_path: Path) -> str:
    key = f"Viteezy_PDF_AI/{pdf_path.name}"
    content_type = mimetypes.guess_type(str(pdf_path))[0] or "application/pdf"

    s3_client = boto3.client(
        "s3",
        region_name=config.spaces_region,
        endpoint_url=config.spaces_endpoint,
        aws_access_key_id=config.spaces_access_key,
        aws_secret_access_key=config.spaces_secret_key,
    )
    s3_client.upload_file(
        str(pdf_path),
        config.spaces_bucket,
        key,
        ExtraArgs={"ACL": "public-read", "ContentType": content_type},
    )
    return f"https://{config.spaces_bucket}.{config.spaces_region}.digitaloceanspaces.com/{key}"


def find_order(orders_collection: Any, order_id: str) -> dict[str, Any] | None:
    oid = safe_object_id(order_id)
    if oid:
        order = orders_collection.find_one({"_id": oid})
        if order:
            return order
    return orders_collection.find_one({"orderNumber": order_id})


def generate_and_upload_pdf(config: Config, order_id: str) -> str:
    projection = {
        "orderNumber": 1,
        "userId": 1,
        "status": 1,
        "items": 1,
        "variantType": 1,
        "couponCode": 1,
        "createdAt": 1,
    }

    with MongoClient(config.mongo_url) as client:
        db = client[config.mongo_db]
        orders_collection = db["orders"]
        order = find_order(orders_collection, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        order = orders_collection.find_one({"_id": order["_id"]}, projection)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        template = DocxTemplate(str(config.template_path))
        context = build_context_for_order(db, order, template, config.images_dir)

        order_number = order.get("orderNumber") or str(order.get("_id"))
        filename_base = f"{slugify(str(order_number))}-{int(datetime.now(timezone.utc).timestamp() * 1000)}-{uuid.uuid4().hex[:6]}"
        output_docx = config.output_docx_dir / f"{filename_base}.docx"
        output_pdf = config.output_pdf_dir / f"{filename_base}.pdf"

        template.render(context)
        template.save(str(output_docx))

        if not convert_docx_to_pdf(output_docx, output_pdf):
            raise HTTPException(
                status_code=500,
                detail="Failed to convert DOCX to PDF. Ensure Microsoft Word or LibreOffice is installed on this machine.",
            )

        try:
            return upload_pdf_to_spaces(config, output_pdf)
        except Exception as exc:
            LOGGER.exception("DigitalOcean upload failed: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to upload PDF to DigitalOcean Spaces") from exc


logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
app = FastAPI(title="Viteezy PDF Service")
APP_CONFIG = Config.from_env()

if not APP_CONFIG.template_path.exists():
    raise FileNotFoundError(f"Template not found: {APP_CONFIG.template_path}")
ensure_dirs(APP_CONFIG)


@app.post("/generate-pdf")
def generate_pdf(payload: GeneratePdfRequest) -> dict[str, Any]:
    pdf_url = generate_and_upload_pdf(APP_CONFIG, payload.order_id)
    return {
        "success": True,
        "message": "Pdf generated successfully",
        "data": [{"pdf_url": pdf_url}],
    }
