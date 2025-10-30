import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || "3000"),
    host: process.env.HOST || "localhost",
    nodeEnv: process.env.NODE_ENV || "development",
  },

  // Database Configuration
  database: {
    mongodbUri:
      process.env.MONGODB_URI || "mongodb://localhost:27017/viteezy-phase-2",
    mongodbTestUri:
      process.env.MONGODB_TEST_URI ||
      "mongodb://localhost:27017/viteezy-phase-2-test",
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || "your-super-secret-jwt-key-here",
    expiresIn: process.env.JWT_EXPIRE || "7d",
    refreshSecret:
      process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key-here",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRE || "30d",
  },

  // Email Configuration
  email: {
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587"),
    user: process.env.EMAIL_USER || "harsh.logicgo6@gmail.com",
    pass: process.env.EMAIL_PASS || "acwtvqryginfffxw",
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "5242880"), // 5MB
    uploadPath: process.env.UPLOAD_PATH || "uploads/",
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || "info",
    file: process.env.LOG_FILE || "logs/app.log",
  },
};
