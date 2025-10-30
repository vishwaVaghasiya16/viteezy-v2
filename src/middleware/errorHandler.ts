import { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/AppError";
import { logger } from "@/utils/logger";
import { ApiResponse } from "@/types";

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = "Internal Server Error";
  let errorType = "Server Error";
  let errorText: string | undefined;

  // Handle AppError instances
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    errorType = (error as any).errorType || errorType;
    errorText = (error as any).error || errorText;
  }
  // Handle Mongoose validation errors
  else if (error.name === "ValidationError") {
    statusCode = 400;
    const msgs = Object.values((error as any).errors).map(
      (err: any) => err.message
    );
    message = "Validation error";
    errorType = "Validation error";
    errorText = msgs.join(", ");
  }
  // Handle Mongoose duplicate key errors
  else if ((error as any).code === 11000) {
    statusCode = 400;
    const field = Object.keys((error as any).keyValue)[0];
    message = "Duplicate key";
    errorType = "Database error";
    errorText = `${field} already exists`;
  }
  // Handle JWT errors
  else if (error.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Authentication failed";
    errorType = "Authentication error";
    errorText = "Invalid token";
  } else if (error.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Authentication failed";
    errorType = "Authentication error";
    errorText = "Token expired";
  }
  // Handle CastError (invalid ObjectId)
  else if (error.name === "CastError") {
    statusCode = 400;
    message = "Validation error";
    errorType = "Validation error";
    errorText = "Invalid ID format";
  }

  // Log error
  const mask = (obj: any) => {
    try {
      const clone = JSON.parse(JSON.stringify(obj || {}));
      const redact = (o: any) => {
        const keys = [
          "password",
          "otp",
          "token",
          "accessToken",
          "refreshToken",
        ];
        for (const k of Object.keys(o)) {
          if (keys.includes(k)) o[k] = "[REDACTED]";
          else if (o[k] && typeof o[k] === "object") redact(o[k]);
        }
        return o;
      };
      return redact(clone);
    } catch {
      return {};
    }
  };

  logger.error("Error occurred:", {
    message: error.message,
    stack: error.stack,
    statusCode,
    errorType,
    error: errorText,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    body: mask(req.body),
    params: mask(req.params),
    query: mask(req.query),
  });

  // Send error response
  const response: ApiResponse = {
    success: false,
    message,
    errorType,
    error: errorText,
  };

  res.status(statusCode).json(response);
};
