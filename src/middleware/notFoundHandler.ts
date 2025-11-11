/**
 * @fileoverview 404 Not Found Handler Middleware
 * @description Handles requests to non-existent routes
 * @module middleware/notFoundHandler
 */

import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "@/types";
import { HTTP_STATUS } from "@/constants";

/**
 * Not Found Handler Middleware
 * @function notFoundHandler
 * @description Handles 404 errors for routes that don't exist
 * This middleware should be registered after all routes
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {void}
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const response: ApiResponse = {
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    errorType: "NotFoundError",
    error: "The requested resource was not found on this server",
  };

  res.status(HTTP_STATUS.NOT_FOUND).json(response);
};
