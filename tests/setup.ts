/**
 * @fileoverview Jest Test Setup
 * @description Global test configuration and setup
 * @module tests/setup
 */

import "../src/config/bootstrapEnv";

Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "8080",
  HOST: "0.0.0.0",
  MONGODB_URI: "mongodb://127.0.0.1:27017/viteezy-test",
  MONGODB_TEST_URI: "mongodb://127.0.0.1:27017/viteezy-test",
  JWT_SECRET: "01234567890123456789012345678901",
  JWT_REFRESH_SECRET: "01234567890123456789012345678901",
  JWT_EXPIRE: "15m",
  JWT_REFRESH_EXPIRE: "7d",
  APP_BASE_URL: "http://127.0.0.1:8080",
  FRONTEND_URL: "http://127.0.0.1:8080",
  ADMIN_PANEL_URL: "http://127.0.0.1:8081",
  CORS_ORIGIN: "http://127.0.0.1:8080",
  EMAIL_HOST: "smtp.example.test",
  EMAIL_PORT: "587",
  EMAIL_USER: "",
  EMAIL_PASS: "",
  MAX_FILE_SIZE: "5242880",
  UPLOAD_PATH: "uploads/",
  RATE_LIMIT_WINDOW_MS: "900000",
  RATE_LIMIT_MAX_REQUESTS: "100",
  LOG_LEVEL: "error",
  LOG_FILE: "logs/test.log",
  DIGITALOCEAN_SPACES_ENDPOINT: "",
  DIGITALOCEAN_CALLBACK_URL: "",
  DIGITALOCEAN_SPACES_REGION: "",
  DIGITALOCEAN_BUCKET_NAME: "",
  DIGITALOCEAN_ACCESS_KEY: "",
  DIGITALOCEAN_SPACES_SECRET_KEY: "",
  DIGITALOCEAN_CLIENT_SECRET: "",
  DO_SPACES_CDN_BASE_URL: "",
  POSTNL_URL: "https://api.postnl.nl/v2/address/benelux",
  POSTNL_API_KEY: "",
  POSTNL_SHIPMENT_API_KEY: "",
  POSTNL_TIMEOUT_MS: "5000",
  POSTNL_API_URL: "https://api.postnl.nl",
  POSTNL_CUSTOMER_NUMBER: "",
  POSTNL_XML_FOLDER: "",
  POSTNL_RESPONSE_XML_FOLDER: "",
  POSTNL_STATUS_SYNC_SCHEDULE: "*/30 * * * *",
  POSTNL_RESPONSE_JOB_SCHEDULE: "*/5 * * * *",
  POSTNL_FULFILMENT_JOB_SCHEDULE: "*/5 * * * *",
  GOOGLE_CLIENT_ID: "",
  INFOBIP_URL: "https://example.api.infobip.com",
  INFOBIP_API_KEY: "",
  SMS_FROM: "TestApp",
  BREVO_API_KEY: "",
  BREVO_FROM_EMAIL: "noreply@example.test",
  BREVO_FROM_NAME: "Test",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  MOLLIE_API_KEY: "",
  PDF_GENERATION_API_URL: "",
  PHARMACIST_CSV_FOLDER: "/tmp/viteezy-test-csv",
  PHARMACIST_EMAIL: "pharmacist@example.test",
  PHARMACIST_CSV_SUBJECT: "Test CSV",
  PHARMACIST_JOB_SCHEDULE: "*/5 * * * *",
  PACKING_SLIP_PDF_JOB_SCHEDULE: "*/5 * * * *",
  COUPON_SCHEDULE_JOB_CRON: "*/5 * * * *",
  HEADER_BANNER_CRON_SCHEDULE: "*/5 * * * *",
  SUBSCRIPTION_RENEWAL_CRON_PRODUCTION: "0 2 * * *",
  SUBSCRIPTION_RENEWAL_CRON_NON_PRODUCTION: "0 * * * *",
  SFTP_REMOTE_HOST: "",
  SFTP_USERNAME: "",
  SFTP_PORT: "22",
  SFTP_PRIVATEKEY_FILENAME: "",
  SFTP_PRIVATE_KEY: "",
  GOOGLE_TRANSLATE_API_KEY: "",
  TRANSLATION_ENABLED: "false",
  ONESIGNAL_APP_ID: "",
  ONESIGNAL_REST_API_KEY: "",
  BEHIND_PROXY: "false",
  TRUST_PROXY: "",
  AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT: "false",
  OTP_EXPIRES_IN: "5",
  ADMIN_EMAIL: "admin@example.test",
  SENDGRID_FROM_EMAIL: "",
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
};

// Global test timeout
jest.setTimeout(10000);

// Mock MongoDB connection
jest.mock("mongoose", () => {
  const actualMongoose = jest.requireActual("mongoose");
  return {
    ...actualMongoose,
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
  };
});

// Setup and teardown hooks
beforeAll(async () => {
  // Global test setup
});

afterAll(async () => {
  // Global test cleanup
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
});
