#!/usr/bin/env python3
"""FastAPI service to generate order PDF and upload it to DigitalOcean Spaces."""

from __future__ import annotations

import logging
import os
import re
import shutil
import subprocess
import sys
import time
import threading
import uuid
import atexit
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

import boto3
import requests
from bson import ObjectId
from docx.shared import Mm
from docxtpl import DocxTemplate, InlineImage
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image as PILImage, UnidentifiedImageError
from pydantic import BaseModel, Field
from pymongo import MongoClient


LOGGER = logging.getLogger("pdf_service")
WORD_CONVERSION_LOCK = threading.Lock()
MONGO_CLIENT_LOCK = threading.RLock()
SPACES_CLIENT_LOCK = threading.Lock()
MONGO_CLIENT: MongoClient | None = None
MONGO_DB: Any | None = None
SPACES_CLIENT: Any | None = None


@dataclass
class Config:
    mongo_url: str
    mongo_db: str
    template_path: Path
    spaces_access_key: str
    spaces_secret_key: str
    spaces_bucket: str
    spaces_region: str
    spaces_endpoint: str

    @staticmethod
    def from_env() -> "Config":
        load_dotenv()

        mongo_url = os.getenv("MONGODB_URI")
        mongo_db = os.getenv("MONGODB_DB")
        spaces_access_key = os.getenv("DIGITALOCEAN_ACCESS_KEY")
        spaces_secret_key = os.getenv("DIGITALOCEAN_CLIENT_SECRET") or os.getenv("DIGITALOCEAN_SPACES_SECRET_KEY")
        spaces_bucket = os.getenv("DIGITALOCEAN_BUCKET_NAME")
        spaces_region = os.getenv("DIGITALOCEAN_SPACES_REGION")
        spaces_endpoint = os.getenv("DIGITALOCEAN_SPACES_ENDPOINT")

        missing = [
            key
            for key, value in [
                ("MONGODB_URI", mongo_url),
                ("MONGODB_DB", mongo_db),
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
            template_path=Path(__file__).parent / "template.docx",
            spaces_access_key=spaces_access_key,
            spaces_secret_key=spaces_secret_key,
            spaces_bucket=spaces_bucket,
            spaces_region=spaces_region,
            spaces_endpoint=spaces_endpoint.rstrip("/"),
        )


class GeneratePdfRequest(BaseModel):
    order_id: str = Field(..., min_length=1)


def build_api_response(success: bool, message: str, data: Any | None = None) -> dict[str, Any]:
    return {
        "success": success,
        "message": message,
        "data": data or {},
    }


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


def extract_ingredient_name(ingredient_doc: dict[str, Any]) -> str | None:
    name_obj = ingredient_doc.get("name")
    name_en = None
    if isinstance(name_obj, dict):
        name_en = name_obj.get("en") or next((v for v in name_obj.values() if isinstance(v, str)), None)
    elif isinstance(name_obj, str):
        name_en = name_obj
    if not name_en:
        return None
    clean_name = str(name_en).strip()
    return clean_name or None


def download_image(image_url: str) -> BytesIO | None:
    normalized_url = str(image_url).strip().strip("\"'").replace("\n", "").replace("\r", "")
    if not normalized_url:
        return None

    try:
        response = requests.get(normalized_url, timeout=30)
        response.raise_for_status()
    except Exception as exc:
        LOGGER.warning("Failed to download image %s: %s", normalized_url, exc)
        return None

    # Normalize to a PNG that python-docx can always parse.
    try:
        with PILImage.open(BytesIO(response.content)) as img:
            img.load()
            normalized = img.convert("RGBA") if "A" in img.getbands() else img.convert("RGB")
            image_stream = BytesIO()
            normalized.save(image_stream, format="PNG")
            image_stream.seek(0)
            return image_stream
    except UnidentifiedImageError:
        LOGGER.warning("Downloaded content is not a supported image %s", normalized_url)
        return None
    except Exception as exc:
        LOGGER.warning("Failed to normalize image %s: %s", normalized_url, exc)
        return None


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
    order: dict[str, Any],
    template: DocxTemplate,
    user_doc: dict[str, Any] | None,
    product_docs_by_id: dict[ObjectId, dict[str, Any]],
    ingredients_by_product_id: dict[ObjectId, list[str]],
) -> dict[str, Any]:
    user_name = extract_user_name(user_doc)

    blend: list[dict[str, Any]] = []
    for item in order.get("items", []):
        product_id = safe_object_id(item.get("productId"))
        product_doc = product_docs_by_id.get(product_id) if product_id else None
        ingredient_names = ingredients_by_product_id.get(product_id, []) if product_id else []

        image_url = get_product_image_url(product_doc)
        image_value: Any = ""
        if image_url:
            image_stream = download_image(image_url)
            if image_stream:
                image_value = InlineImage(template, image_stream, width=Mm(22))

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


def get_mongo_client(config: Config) -> MongoClient:
    global MONGO_CLIENT
    if MONGO_CLIENT is not None:
        return MONGO_CLIENT

    with MONGO_CLIENT_LOCK:
        if MONGO_CLIENT is not None:
            return MONGO_CLIENT
        client = MongoClient(
            config.mongo_url,
            serverSelectionTimeoutMS=10000,
            connectTimeoutMS=10000,
            socketTimeoutMS=30000,
            maxPoolSize=100,
            minPoolSize=0,
            appname="viteezy-pdf-service",
        )
        client.admin.command("ping")
        MONGO_CLIENT = client
        LOGGER.info("MongoDB client initialized with shared pool")
        return MONGO_CLIENT


def get_mongo_db(config: Config) -> Any:
    global MONGO_DB
    if MONGO_DB is not None:
        return MONGO_DB

    with MONGO_CLIENT_LOCK:
        if MONGO_DB is not None:
            return MONGO_DB
        client = get_mongo_client(config)
        MONGO_DB = client[config.mongo_db]
        return MONGO_DB


def close_mongo_client() -> None:
    global MONGO_CLIENT, MONGO_DB
    if MONGO_CLIENT is not None:
        try:
            MONGO_CLIENT.close()
        finally:
            MONGO_CLIENT = None
            MONGO_DB = None


def get_spaces_client(config: Config) -> Any:
    global SPACES_CLIENT
    if SPACES_CLIENT is not None:
        return SPACES_CLIENT

    with SPACES_CLIENT_LOCK:
        if SPACES_CLIENT is not None:
            return SPACES_CLIENT
        SPACES_CLIENT = boto3.client(
            "s3",
            region_name=config.spaces_region,
            endpoint_url=config.spaces_endpoint,
            aws_access_key_id=config.spaces_access_key,
            aws_secret_access_key=config.spaces_secret_key,
        )
        return SPACES_CLIENT


def upload_pdf_to_spaces(config: Config, pdf_path: Path) -> str:
    key = f"Viteezy_PDF_AI/{pdf_path.name}"
    s3_client = get_spaces_client(config)
    s3_client.upload_file(
        str(pdf_path),
        config.spaces_bucket,
        key,
        ExtraArgs={"ACL": "public-read", "ContentType": "application/pdf"},
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
    LOGGER.info("Starting PDF generation for order_id=%s", order_id)
    projection = {
        "orderNumber": 1,
        "userId": 1,
        "status": 1,
        "items": 1,
        "variantType": 1,
        "couponCode": 1,
        "createdAt": 1,
    }

    LOGGER.info("Fetching order context from MongoDB for order_id=%s", order_id)
    db = MONGO_DB if MONGO_DB is not None else get_mongo_db(config)
    orders_collection = db["orders"]
    users_collection = db["users"]
    products_collection = db["products"]
    ingredients_collection = db["product_ingredients"]

    order = find_order(orders_collection, order_id)
    if not order:
        LOGGER.warning("Order not found for order_id=%s", order_id)
        raise HTTPException(status_code=404, detail="Order not found")

    order = orders_collection.find_one({"_id": order["_id"]}, projection)
    if not order:
        LOGGER.warning("Order projection lookup failed for order_id=%s", order_id)
        raise HTTPException(status_code=404, detail="Order not found")

    user_doc: dict[str, Any] | None = None
    user_id = safe_object_id(order.get("userId"))
    if user_id:
        user_doc = users_collection.find_one({"_id": user_id}, {"name": 1, "firstName": 1, "lastName": 1})

    product_ids: list[ObjectId] = []
    seen_ids: set[ObjectId] = set()
    for item in order.get("items", []):
        pid = safe_object_id(item.get("productId"))
        if pid and pid not in seen_ids:
            seen_ids.add(pid)
            product_ids.append(pid)

    product_docs_by_id: dict[ObjectId, dict[str, Any]] = {}
    ingredients_by_product_id: dict[ObjectId, list[str]] = {}

    if product_ids:
        for product_doc in products_collection.find({"_id": {"$in": product_ids}}, {"name": 1, "productImage": 1}):
            product_docs_by_id[product_doc["_id"]] = product_doc

        ingredient_cursor = ingredients_collection.find(
            {"products": {"$in": product_ids}, "isDeleted": {"$ne": True}},
            {"name": 1, "products": 1},
        )
        for ingredient_doc in ingredient_cursor:
            ingredient_name = extract_ingredient_name(ingredient_doc)
            if not ingredient_name:
                continue

            products_field = ingredient_doc.get("products")
            if isinstance(products_field, list):
                related_ids = [pid for pid in products_field if isinstance(pid, ObjectId)]
            elif isinstance(products_field, ObjectId):
                related_ids = [products_field]
            else:
                related_ids = []

            for pid in related_ids:
                if pid not in seen_ids:
                    continue
                names = ingredients_by_product_id.setdefault(pid, [])
                if ingredient_name not in names:
                    names.append(ingredient_name)

    LOGGER.info("Rendering DOCX for order_id=%s", order_id)
    template = DocxTemplate(str(config.template_path))
    context = build_context_for_order(order, template, user_doc, product_docs_by_id, ingredients_by_product_id)

    order_number = order.get("orderNumber") or str(order.get("_id"))
    filename_base = f"{slugify(str(order_number))}-{int(datetime.now(timezone.utc).timestamp() * 1000)}-{uuid.uuid4().hex[:6]}"
    with TemporaryDirectory(prefix="viteezy_pdf_") as tmp_dir:
        tmp_path = Path(tmp_dir)
        output_docx = tmp_path / f"{filename_base}.docx"
        output_pdf = tmp_path / f"{filename_base}.pdf"

        template.render(context)
        template.save(str(output_docx))

        LOGGER.info("Converting DOCX to PDF for order_id=%s", order_id)
        if not convert_docx_to_pdf(output_docx, output_pdf):
            raise HTTPException(
                status_code=500,
                detail="Failed to convert DOCX to PDF. Ensure Microsoft Word or LibreOffice is installed on this machine.",
            )

        try:
            LOGGER.info("Uploading PDF to DigitalOcean Spaces for order_id=%s", order_id)
            pdf_url = upload_pdf_to_spaces(config, output_pdf)
        except Exception as exc:
            LOGGER.exception("DigitalOcean upload failed: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to upload PDF to DigitalOcean Spaces") from exc

    orders_collection.update_one(
        {"_id": order["_id"], "status": "Confirmed"},
        {"$set": {"status": "PACKING_SLIP_READY"}},
    )
    LOGGER.info("PDF generation completed for order_id=%s", order_id)
    return pdf_url


logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
router = APIRouter()
APP_CONFIG = Config.from_env()
MONGO_DB = get_mongo_db(APP_CONFIG)
atexit.register(close_mongo_client)

if not APP_CONFIG.template_path.exists():
    raise FileNotFoundError(f"Template not found: {APP_CONFIG.template_path}")


@router.post("/generate-pdf")
def generate_pdf(payload: GeneratePdfRequest) -> dict[str, Any]:
    LOGGER.info("Received generate-pdf request for order_id=%s", payload.order_id)
    try:
        pdf_url = generate_and_upload_pdf(APP_CONFIG, payload.order_id)
        return build_api_response(True, "Pdf generated successfully", {"pdf_url": pdf_url})
    except HTTPException as exc:
        LOGGER.exception("generate-pdf request failed for order_id=%s", payload.order_id)
        detail = exc.detail
        if isinstance(detail, dict):
            message = str(detail.get("message") or detail.get("detail") or "Request failed")
            data = detail.get("data") if isinstance(detail.get("data"), dict) else {}
        else:
            message = str(detail or "Request failed")
            data = {}
        return JSONResponse(
            status_code=exc.status_code,
            content=build_api_response(False, message, data),
        )
    except Exception as exc:
        LOGGER.exception("Unexpected error in generate-pdf for order_id=%s", payload.order_id)
        return JSONResponse(
            status_code=500,
            content=build_api_response(False, "Unexpected error while generating PDF", {"error": str(exc)}),
        )
