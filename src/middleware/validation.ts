import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { AppError } from "@/utils/AppError";

export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    const firstMessage = first?.msg || "Validation error";
    const appErr: any = new AppError("Validation error", 400);
    appErr.errorType = "Validation error";
    appErr.error = firstMessage;
    throw appErr;
  }

  next();
};
