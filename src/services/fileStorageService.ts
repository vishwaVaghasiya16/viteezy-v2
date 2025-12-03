import { randomUUID } from "crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { config } from "@/config";
import { AppError } from "@/utils/AppError";
import { logger } from "@/utils/logger";

const { spaces } = config;

const s3Client = new S3Client({
  region: spaces.region,
  endpoint: spaces.endpoint || undefined,
  forcePathStyle: false,
  credentials:
    spaces.accessKeyId && spaces.secretAccessKey
      ? {
          accessKeyId: spaces.accessKeyId,
          secretAccessKey: spaces.secretAccessKey,
        }
      : undefined,
});

class FileStorageService {
  private readonly projectRoot = "viteezy-phase-2";

  private ensureConfig(): void {
    if (
      !spaces.bucket ||
      !spaces.endpoint ||
      !spaces.accessKeyId ||
      !spaces.secretAccessKey
    ) {
      const missingFields = [];
      if (!spaces.bucket) missingFields.push("bucket");
      if (!spaces.endpoint) missingFields.push("endpoint");
      if (!spaces.accessKeyId) missingFields.push("accessKeyId");
      if (!spaces.secretAccessKey) missingFields.push("secretAccessKey");

      logger.error("File storage configuration incomplete", {
        missingFields,
        bucket: spaces.bucket || "NOT SET",
        endpoint: spaces.endpoint || "NOT SET",
      });

      throw new AppError(
        `File storage is not configured. Missing: ${missingFields.join(
          ", "
        )}. Please set DigitalOcean Spaces credentials in environment variables.`,
        500
      );
    }
  }

  private buildPublicUrl(key: string): string {
    if (spaces.cdnBaseUrl) {
      return `${spaces.cdnBaseUrl.replace(/\/$/, "")}/${key}`;
    }

    const endpointHost = spaces.endpoint.replace(/^https?:\/\//, "");
    return `https://${spaces.bucket}.${endpointHost}/${key}`;
  }

  private buildObjectKey(modulePath: string, extension: string): string {
    const datePrefix = new Date().toISOString().split("T")[0];
    return `${
      this.projectRoot
    }/${modulePath}/${datePrefix}/${randomUUID()}.${extension}`;
  }

  async uploadFile(
    modulePath: string,
    file: Express.Multer.File
  ): Promise<string> {
    this.ensureConfig();

    const extension = file.originalname?.split(".").pop() || "bin";
    const sanitizedModule = modulePath.replace(/^\/+|\/+$/g, "") || "general";
    const key = this.buildObjectKey(sanitizedModule, extension);

    const command = new PutObjectCommand({
      Bucket: spaces.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: "public-read",
    });

    try {
      await s3Client.send(command);
      logger.info(`Uploaded file to Spaces: ${key}`, {
        bucket: spaces.bucket,
        module: sanitizedModule,
      });

      return this.buildPublicUrl(key);
    } catch (error: any) {
      logger.error("Failed to upload file to Spaces", {
        bucket: spaces.bucket,
        endpoint: spaces.endpoint,
        region: spaces.region,
        key,
        error: error.message,
        errorName: error.name,
      });

      // Re-throw with more context
      if (error.name === "NoSuchBucket") {
        throw new AppError(
          `DigitalOcean Spaces bucket "${spaces.bucket}" does not exist. Please check your bucket name and region configuration.`,
          500
        );
      }

      throw error;
    }
  }

  private extractKeyFromUrl(url?: string | null): string | null {
    if (!url) return null;
    const normalizedUrl = url.trim();
    const possibleBases: string[] = [];

    if (spaces.cdnBaseUrl) {
      possibleBases.push(spaces.cdnBaseUrl.replace(/\/$/, ""));
    }

    const endpointHost = spaces.endpoint.replace(/^https?:\/\//, "");
    possibleBases.push(`https://${spaces.bucket}.${endpointHost}`);

    for (const base of possibleBases) {
      if (normalizedUrl.startsWith(base)) {
        const key = normalizedUrl.substring(base.length).replace(/^\/+/, "");
        if (key) {
          return key;
        }
      }
    }

    return null;
  }

  async deleteFileByUrl(url?: string | null): Promise<void> {
    this.ensureConfig();
    const key = this.extractKeyFromUrl(url);
    if (!key) {
      return;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: spaces.bucket,
        Key: key,
      });
      await s3Client.send(command);
      logger.info(`Deleted file from Spaces: ${key}`);
    } catch (error) {
      logger.warn("Failed to delete file from Spaces", { key, error });
    }
  }
}

export const fileStorageService = new FileStorageService();
