/**
 * Validates process.env once at startup (fail-fast). No secrets as code defaults.
 * @module config/envSchema
 */
import { z, type RefinementCtx, type ZodIssue } from "zod";
import path from "path";

/** Trim and strip wrapping single/double quotes from env values. */
export function normalizeEnvString(value: string | undefined): string {
  if (value === undefined || value === null) return "";
  const trimmed = String(value).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function pick(raw: NodeJS.ProcessEnv, key: string): string {
  return normalizeEnvString(raw[key]);
}

const NodeEnv = z.enum(["development", "production", "test"]);

const envSchemaBase = z.object({
    NODE_ENV: NodeEnv,
    PORT: z.string().min(1),
    HOST: z.string().min(1),

    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
    MONGODB_TEST_URI: z.string(),

    JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
    JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
    JWT_EXPIRE: z.string().min(1),
    JWT_REFRESH_EXPIRE: z.string().min(1),

    APP_BASE_URL: z.string(),
    FRONTEND_URL: z.string().min(1, "FRONTEND_URL is required"),
    ADMIN_PANEL_URL: z.string(),
    CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required"),

    EMAIL_HOST: z.string().min(1),
    EMAIL_PORT: z.string().min(1),
    EMAIL_USER: z.string(),
    EMAIL_PASS: z.string(),

    MAX_FILE_SIZE: z.string().min(1),
    UPLOAD_PATH: z.string().min(1),

    RATE_LIMIT_WINDOW_MS: z.string().min(1),
    RATE_LIMIT_MAX_REQUESTS: z.string().min(1),

    LOG_LEVEL: z.string().min(1),
    LOG_FILE: z.string().min(1),

    DIGITALOCEAN_SPACES_ENDPOINT: z.string(),
    DIGITALOCEAN_CALLBACK_URL: z.string(),
    DIGITALOCEAN_SPACES_REGION: z.string(),
    DIGITALOCEAN_BUCKET_NAME: z.string(),
    DIGITALOCEAN_ACCESS_KEY: z.string(),
    DIGITALOCEAN_SPACES_SECRET_KEY: z.string(),
    DIGITALOCEAN_CLIENT_SECRET: z.string(),
    DO_SPACES_CDN_BASE_URL: z.string(),

    POSTNL_URL: z.string().min(1),
    POSTNL_API_KEY: z.string(),
    POSTNL_SHIPMENT_API_KEY: z.string(),
    POSTNL_TIMEOUT_MS: z.string().min(1),
    POSTNL_API_URL: z.string().min(1),
    POSTNL_CUSTOMER_NUMBER: z.string(),

    POSTNL_XML_FOLDER: z.string(),
    POSTNL_RESPONSE_XML_FOLDER: z.string(),
    POSTNL_STATUS_SYNC_SCHEDULE: z.string().min(1),
    POSTNL_RESPONSE_JOB_SCHEDULE: z.string().min(1),
    POSTNL_FULFILMENT_JOB_SCHEDULE: z.string().min(1),

    GOOGLE_CLIENT_ID: z.string(),

    INFOBIP_URL: z.string(),
    INFOBIP_API_KEY: z.string(),
    SMS_FROM: z.string(),

    BREVO_API_KEY: z.string(),
    BREVO_FROM_EMAIL: z.string().min(1),
    BREVO_FROM_NAME: z.string().min(1),

    STRIPE_SECRET_KEY: z.string(),
    STRIPE_WEBHOOK_SECRET: z.string(),
    MOLLIE_API_KEY: z.string(),

    PDF_GENERATION_API_URL: z.string(),

    PHARMACIST_CSV_FOLDER: z.string(),
    PHARMACIST_EMAIL: z.string().min(1),
    PHARMACIST_CSV_SUBJECT: z.string().min(1),
    PHARMACIST_JOB_SCHEDULE: z.string().min(1),

    PACKING_SLIP_PDF_JOB_SCHEDULE: z.string().min(1),
    COUPON_SCHEDULE_JOB_CRON: z.string().min(1),
    HEADER_BANNER_CRON_SCHEDULE: z.string().min(1),
    SUBSCRIPTION_RENEWAL_CRON_PRODUCTION: z.string().min(1),
    SUBSCRIPTION_RENEWAL_CRON_NON_PRODUCTION: z.string().min(1),

    SFTP_REMOTE_HOST: z.string(),
    SFTP_USERNAME: z.string(),
    SFTP_PORT: z.string().min(1),
    SFTP_PRIVATEKEY_FILENAME: z.string(),
    SFTP_PRIVATE_KEY: z.string(),

    GOOGLE_TRANSLATE_API_KEY: z.string(),
    TRANSLATION_ENABLED: z.string(),

    ONESIGNAL_APP_ID: z.string(),
    ONESIGNAL_REST_API_KEY: z.string(),

    BEHIND_PROXY: z.string(),
    TRUST_PROXY: z.string(),

    AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT: z.string(),

    OTP_EXPIRES_IN: z.string().min(1),

    ADMIN_EMAIL: z.string(),
    SENDGRID_FROM_EMAIL: z.string(),
  });

type EnvSchemaInput = z.infer<typeof envSchemaBase>;

function refineEnvForProduction(data: EnvSchemaInput, ctx: RefinementCtx): void {
  if (data.NODE_ENV === "production") {
    if (data.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "JWT_SECRET must be at least 32 characters in production",
        path: ["JWT_SECRET"],
      });
    }
    if (data.JWT_REFRESH_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "JWT_REFRESH_SECRET must be at least 32 characters in production",
        path: ["JWT_REFRESH_SECRET"],
      });
    }
    if (!data.APP_BASE_URL.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "APP_BASE_URL is required in production",
        path: ["APP_BASE_URL"],
      });
    }
  }
}

export const envSchema = envSchemaBase.superRefine(refineEnvForProduction);

export type ValidatedEnv = z.infer<typeof envSchema>;

export function parseProcessEnv(raw: NodeJS.ProcessEnv): ValidatedEnv {
  const p = (key: string) => pick(raw, key);

  const nodeEnvRaw = p("NODE_ENV");
  let NODE_ENV: z.infer<typeof NodeEnv> = "development";
  if (nodeEnvRaw === "production" || nodeEnvRaw === "test") {
    NODE_ENV = nodeEnvRaw;
  } else if (nodeEnvRaw && nodeEnvRaw !== "development") {
    throw new Error(
      `Invalid NODE_ENV: ${nodeEnvRaw}. Must be development, production, or test.`
    );
  }

  const port = p("PORT") || "8080";
  const host = p("HOST") || "0.0.0.0";

  let appBaseUrl = p("APP_BASE_URL");
  if (!appBaseUrl.trim() && NODE_ENV !== "production") {
    appBaseUrl = `http://127.0.0.1:${port}`;
  }

  const input = {
    NODE_ENV,
    PORT: port,
    HOST: host,

    MONGODB_URI: p("MONGODB_URI"),
    MONGODB_TEST_URI: p("MONGODB_TEST_URI"),

    JWT_SECRET: p("JWT_SECRET"),
    JWT_REFRESH_SECRET: p("JWT_REFRESH_SECRET"),
    JWT_EXPIRE: p("JWT_EXPIRE"),
    JWT_REFRESH_EXPIRE: p("JWT_REFRESH_EXPIRE"),

    APP_BASE_URL: appBaseUrl,
    FRONTEND_URL: p("FRONTEND_URL"),
    ADMIN_PANEL_URL: p("ADMIN_PANEL_URL"),
    CORS_ORIGIN: p("CORS_ORIGIN"),

    EMAIL_HOST: p("EMAIL_HOST") || "smtp.gmail.com",
    EMAIL_PORT: p("EMAIL_PORT") || "587",
    EMAIL_USER: p("EMAIL_USER"),
    EMAIL_PASS: p("EMAIL_PASS"),

    MAX_FILE_SIZE: p("MAX_FILE_SIZE") || "5242880",
    UPLOAD_PATH: p("UPLOAD_PATH") || "uploads/",

    RATE_LIMIT_WINDOW_MS: p("RATE_LIMIT_WINDOW_MS") || "900000",
    RATE_LIMIT_MAX_REQUESTS: p("RATE_LIMIT_MAX_REQUESTS") || "100",

    LOG_LEVEL: p("LOG_LEVEL") || "info",
    LOG_FILE: p("LOG_FILE") || "logs/app.log",

    DIGITALOCEAN_SPACES_ENDPOINT: p("DIGITALOCEAN_SPACES_ENDPOINT"),
    DIGITALOCEAN_CALLBACK_URL: p("DIGITALOCEAN_CALLBACK_URL"),
    DIGITALOCEAN_SPACES_REGION: p("DIGITALOCEAN_SPACES_REGION"),
    DIGITALOCEAN_BUCKET_NAME: p("DIGITALOCEAN_BUCKET_NAME"),
    DIGITALOCEAN_ACCESS_KEY: p("DIGITALOCEAN_ACCESS_KEY"),
    DIGITALOCEAN_SPACES_SECRET_KEY: p("DIGITALOCEAN_SPACES_SECRET_KEY"),
    DIGITALOCEAN_CLIENT_SECRET: p("DIGITALOCEAN_CLIENT_SECRET"),
    DO_SPACES_CDN_BASE_URL: p("DO_SPACES_CDN_BASE_URL"),

    POSTNL_URL: p("POSTNL_URL"),
    POSTNL_API_KEY: p("POSTNL_API_KEY"),
    POSTNL_SHIPMENT_API_KEY: p("POSTNL_SHIPMENT_API_KEY"),
    POSTNL_TIMEOUT_MS: p("POSTNL_TIMEOUT_MS") || "5000",
    POSTNL_API_URL: p("POSTNL_API_URL"),
    POSTNL_CUSTOMER_NUMBER: p("POSTNL_CUSTOMER_NUMBER"),

    POSTNL_XML_FOLDER: p("POSTNL_XML_FOLDER"),
    POSTNL_RESPONSE_XML_FOLDER: p("POSTNL_RESPONSE_XML_FOLDER"),
    POSTNL_STATUS_SYNC_SCHEDULE: p("POSTNL_STATUS_SYNC_SCHEDULE") || "*/30 * * * *",
    POSTNL_RESPONSE_JOB_SCHEDULE:
      p("POSTNL_RESPONSE_JOB_SCHEDULE") || "*/5 * * * *",
    POSTNL_FULFILMENT_JOB_SCHEDULE:
      p("POSTNL_FULFILMENT_JOB_SCHEDULE") || "*/5 * * * *",

    GOOGLE_CLIENT_ID: p("GOOGLE_CLIENT_ID"),

    INFOBIP_URL: p("INFOBIP_URL"),
    INFOBIP_API_KEY: p("INFOBIP_API_KEY"),
    SMS_FROM: p("SMS_FROM"),

    BREVO_API_KEY: p("BREVO_API_KEY"),
    BREVO_FROM_EMAIL: p("BREVO_FROM_EMAIL"),
    BREVO_FROM_NAME: p("BREVO_FROM_NAME"),

    STRIPE_SECRET_KEY: p("STRIPE_SECRET_KEY"),
    STRIPE_WEBHOOK_SECRET: p("STRIPE_WEBHOOK_SECRET"),
    MOLLIE_API_KEY: p("MOLLIE_API_KEY"),

    PDF_GENERATION_API_URL: p("PDF_GENERATION_API_URL"),

    PHARMACIST_CSV_FOLDER: p("PHARMACIST_CSV_FOLDER"),
    PHARMACIST_EMAIL: p("PHARMACIST_EMAIL"),
    PHARMACIST_CSV_SUBJECT: p("PHARMACIST_CSV_SUBJECT"),
    PHARMACIST_JOB_SCHEDULE: p("PHARMACIST_JOB_SCHEDULE") || "*/5 * * * *",

    PACKING_SLIP_PDF_JOB_SCHEDULE:
      p("PACKING_SLIP_PDF_JOB_SCHEDULE") || "*/5 * * * *",
    COUPON_SCHEDULE_JOB_CRON:
      p("COUPON_SCHEDULE_JOB_CRON") || "*/5 * * * *",
    HEADER_BANNER_CRON_SCHEDULE:
      p("HEADER_BANNER_CRON_SCHEDULE") || "*/5 * * * *",
    SUBSCRIPTION_RENEWAL_CRON_PRODUCTION:
      p("SUBSCRIPTION_RENEWAL_CRON_PRODUCTION") || "0 2 * * *",
    SUBSCRIPTION_RENEWAL_CRON_NON_PRODUCTION:
      p("SUBSCRIPTION_RENEWAL_CRON_NON_PRODUCTION") || "0 * * * *",

    SFTP_REMOTE_HOST: p("SFTP_REMOTE_HOST"),
    SFTP_USERNAME: p("SFTP_USERNAME"),
    SFTP_PORT: p("SFTP_PORT") || "22",
    SFTP_PRIVATEKEY_FILENAME: p("SFTP_PRIVATEKEY_FILENAME"),
    SFTP_PRIVATE_KEY: p("SFTP_PRIVATE_KEY"),

    GOOGLE_TRANSLATE_API_KEY: p("GOOGLE_TRANSLATE_API_KEY"),
    TRANSLATION_ENABLED: p("TRANSLATION_ENABLED") || "false",

    ONESIGNAL_APP_ID: p("ONESIGNAL_APP_ID"),
    ONESIGNAL_REST_API_KEY: p("ONESIGNAL_REST_API_KEY"),

    BEHIND_PROXY: p("BEHIND_PROXY") || "false",
    TRUST_PROXY: p("TRUST_PROXY"),

    AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT:
      p("AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT") || "false",

    OTP_EXPIRES_IN: p("OTP_EXPIRES_IN") || "5",

    ADMIN_EMAIL: p("ADMIN_EMAIL"),
    SENDGRID_FROM_EMAIL: p("SENDGRID_FROM_EMAIL"),
  };

  try {
    return envSchema.parse(input);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      const msgs = err.issues.map(
        (i: ZodIssue) => `${i.path.join(".") || "root"}: ${i.message}`
      );
      console.error("Environment validation failed:\n", msgs.join("\n"));
      throw new Error(`Invalid environment: ${msgs.join("; ")}`);
    }
    throw err;
  }
}

export type AppConfig = ReturnType<typeof buildAppConfig>;

export function buildAppConfig(e: ValidatedEnv) {
  const stripSlash = (u: string) => u.replace(/\/$/, "");

  const spacesEndpoint =
    e.DIGITALOCEAN_SPACES_ENDPOINT || e.DIGITALOCEAN_CALLBACK_URL;

  return {
    server: {
      port: parseInt(e.PORT, 10) || 8080,
      host: e.HOST,
      nodeEnv: e.NODE_ENV,
    },
    database: {
      mongodbUri: e.MONGODB_URI,
      mongodbTestUri: e.MONGODB_TEST_URI,
    },
    jwt: {
      secret: e.JWT_SECRET,
      refreshSecret: e.JWT_REFRESH_SECRET,
      expiresIn: e.JWT_EXPIRE,
      refreshExpiresIn: e.JWT_REFRESH_EXPIRE,
    },
    app: {
      baseUrl: stripSlash(e.APP_BASE_URL),
    },
    frontend: {
      url: stripSlash(e.FRONTEND_URL),
    },
    adminPanel: {
      url: e.ADMIN_PANEL_URL ? stripSlash(e.ADMIN_PANEL_URL) : "",
    },
    email: {
      host: e.EMAIL_HOST,
      port: parseInt(e.EMAIL_PORT, 10),
      user: e.EMAIL_USER,
      pass: e.EMAIL_PASS,
    },
    brevo: {
      apiKey: e.BREVO_API_KEY,
      fromEmail: e.BREVO_FROM_EMAIL,
      fromName: e.BREVO_FROM_NAME,
    },
    upload: {
      maxFileSize: parseInt(e.MAX_FILE_SIZE, 10),
      uploadPath: e.UPLOAD_PATH,
    },
    rateLimit: {
      windowMs: parseInt(e.RATE_LIMIT_WINDOW_MS, 10),
      maxRequests: parseInt(e.RATE_LIMIT_MAX_REQUESTS, 10),
    },
    cors: {
      origins: e.CORS_ORIGIN.split(",")
        .map((o: string) => o.trim())
        .filter(Boolean),
    },
    logging: {
      level: e.LOG_LEVEL,
      file: e.LOG_FILE,
    },
    spaces: {
      endpoint: spacesEndpoint,
      region: e.DIGITALOCEAN_SPACES_REGION,
      bucket: e.DIGITALOCEAN_BUCKET_NAME,
      accessKeyId: e.DIGITALOCEAN_ACCESS_KEY,
      secretAccessKey:
        e.DIGITALOCEAN_SPACES_SECRET_KEY || e.DIGITALOCEAN_CLIENT_SECRET,
      cdnBaseUrl: e.DO_SPACES_CDN_BASE_URL,
    },
    postnl: {
      addressValidationUrl: e.POSTNL_URL,
      apiKey: e.POSTNL_API_KEY,
      shipmentApiKey: e.POSTNL_SHIPMENT_API_KEY,
      timeoutMs: parseInt(e.POSTNL_TIMEOUT_MS, 10),
      apiUrl: e.POSTNL_API_URL,
      customerNumber: e.POSTNL_CUSTOMER_NUMBER,
      fulfilmentXmlFolder: e.POSTNL_XML_FOLDER
        ? path.resolve(e.POSTNL_XML_FOLDER)
        : path.join(process.cwd(), "data", "xml"),
      responseXmlFolder: e.POSTNL_RESPONSE_XML_FOLDER
        ? path.resolve(e.POSTNL_RESPONSE_XML_FOLDER)
        : path.join(process.cwd(), "data", "xml", "responses"),
    },
    google: {
      clientId: e.GOOGLE_CLIENT_ID,
    },
    infobip: {
      url: e.INFOBIP_URL,
      apiKey: e.INFOBIP_API_KEY,
    },
    sms: {
      from: e.SMS_FROM,
    },
    payments: {
      stripeSecretKey: e.STRIPE_SECRET_KEY,
      stripeWebhookSecret: e.STRIPE_WEBHOOK_SECRET,
      mollieApiKey: e.MOLLIE_API_KEY,
    },
    pdf: {
      generationApiUrl: e.PDF_GENERATION_API_URL,
    },
    pharmacist: {
      csvFolder: e.PHARMACIST_CSV_FOLDER.trim()
        ? path.resolve(e.PHARMACIST_CSV_FOLDER)
        : path.join(process.cwd(), "data", "pharmacist-csv"),
      email: e.PHARMACIST_EMAIL,
      csvSubject: e.PHARMACIST_CSV_SUBJECT,
    },
    translation: {
      googleApiKey: e.GOOGLE_TRANSLATE_API_KEY,
      enabled: e.TRANSLATION_ENABLED === "true" && !!e.GOOGLE_TRANSLATE_API_KEY,
    },
    push: {
      oneSignalAppId: e.ONESIGNAL_APP_ID,
      oneSignalRestApiKey: e.ONESIGNAL_REST_API_KEY,
    },
    proxy: {
      behindProxy: e.BEHIND_PROXY === "true",
      trustProxy: e.TRUST_PROXY,
    },
    features: {
      autoCreateSubscriptionOnPayment:
        e.AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT === "true",
    },
    auth: {
      otpExpiresInMinutes: parseInt(e.OTP_EXPIRES_IN, 10) || 5,
    },
    admin: {
      email: e.ADMIN_EMAIL,
      sendgridFromEmailFallback: e.SENDGRID_FROM_EMAIL,
    },
    jobs: {
      packingSlipCron: e.PACKING_SLIP_PDF_JOB_SCHEDULE,
      couponCron: e.COUPON_SCHEDULE_JOB_CRON,
      headerBannerCron: e.HEADER_BANNER_CRON_SCHEDULE,
      pharmacistCron: e.PHARMACIST_JOB_SCHEDULE,
      postnlStatusSyncCron: e.POSTNL_STATUS_SYNC_SCHEDULE,
      postnlResponseCron: e.POSTNL_RESPONSE_JOB_SCHEDULE,
      postnlFulfilmentCron: e.POSTNL_FULFILMENT_JOB_SCHEDULE,
      subscriptionRenewalCronProduction: e.SUBSCRIPTION_RENEWAL_CRON_PRODUCTION,
      subscriptionRenewalCronNonProduction:
        e.SUBSCRIPTION_RENEWAL_CRON_NON_PRODUCTION,
    },
    sftp: {
      host: e.SFTP_REMOTE_HOST,
      username: e.SFTP_USERNAME,
      port: parseInt(e.SFTP_PORT, 10) || 22,
      privateKeyFilename: e.SFTP_PRIVATEKEY_FILENAME,
      privateKey: e.SFTP_PRIVATE_KEY ? e.SFTP_PRIVATE_KEY.trim() : "",
    },
  };
}

export function loadConfig() {
  const env = parseProcessEnv(process.env);
  return buildAppConfig(env);
}
