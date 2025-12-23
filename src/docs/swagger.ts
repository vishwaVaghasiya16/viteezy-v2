import swaggerJsdoc from "swagger-jsdoc";
import { config } from "@/config";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Viteezy Phase 2 API",
      version: "1.0.0",
      description:
        "A comprehensive Node.js TypeScript backend API with MongoDB",
      contact: {
        name: "API Support",
        email: "support@viteezy.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: `http://localhost:${config.server.port}`,
        description: "Development server",
      },
      {
        url: "https://api.viteezy.com",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "User ID",
            },
            name: {
              type: "string",
              description: "User full name",
            },
            email: {
              type: "string",
              format: "email",
              description: "User email address",
            },
            role: {
              type: "string",
              enum: ["user", "admin", "moderator"],
              description: "User role",
            },
            isActive: {
              type: "boolean",
              description: "User active status",
            },
            isEmailVerified: {
              type: "boolean",
              description: "Email verification status",
            },
            avatar: {
              type: "string",
              description: "User avatar URL",
            },
            lastLogin: {
              type: "string",
              format: "date-time",
              description: "Last login timestamp",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Account creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Last update timestamp",
            },
          },
        },
        AuthTokens: {
          type: "object",
          properties: {
            accessToken: {
              type: "string",
              description: "JWT access token",
            },
            refreshToken: {
              type: "string",
              description: "JWT refresh token",
            },
            user: {
              $ref: "#/components/schemas/User",
            },
          },
        },
        ApiResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              description: "Request success status",
            },
            message: {
              type: "string",
              description: "Response message",
            },
            data: {
              type: "object",
              description: "Response data",
            },
            errorType: {
              type: "string",
              description: "Error type/category (only present on errors)",
            },
            error: {
              type: "string",
              description: "Error message (only present on errors)",
            },
            pagination: {
              type: "object",
              properties: {
                page: { type: "number" },
                limit: { type: "number" },
                total: { type: "number" },
                pages: { type: "number" },
                hasNext: { type: "boolean" },
                hasPrev: { type: "boolean" },
              },
            },
          },
        },
        ValidationError: {
          type: "object",
          properties: {
            field: {
              type: "string",
              description: "Field name with error",
            },
            message: {
              type: "string",
              description: "Error message",
            },
            value: {
              type: "string",
              description: "Invalid value",
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
