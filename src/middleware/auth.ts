import jwt, { JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { User, AuthSessions } from "../models/index.model";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";

interface JWTPayload extends JwtPayload {
  userId: string;
  sessionId: string;
}

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
  sessionId?: string;
}

// Authentication middleware
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Access token is required", 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as JWTPayload;

    // Check if session exists and is valid
    const session = await AuthSessions.findOne({
      sessionId: decoded.sessionId,
      userId: decoded.userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      throw new AppError("Invalid or expired session", 401);
    }

    // Get user from database
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AppError("User not found", 401);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError("Account is deactivated", 401);
    }

    // Update last used time
    await AuthSessions.findByIdAndUpdate(session._id, {
      lastUsedAt: new Date(),
    });

    // Add user info to request
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    };
    req.userId = user._id.toString();
    req.sessionId = decoded.sessionId;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError("Invalid token", 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError("Token expired", 401));
    } else {
      next(error);
    }
  }
};

// Authorization middleware
export const authorize = (...roles: string[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      next(new AppError("Authentication required", 401));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError("Insufficient permissions", 403));
      return;
    }

    next();
  };
};

// Optional authentication middleware (doesn't throw error if no token)
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      next();
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key"
      ) as JWTPayload;

      // Check if session exists and is valid
      const session = await AuthSessions.findOne({
        sessionId: decoded.sessionId,
        userId: decoded.userId,
        isRevoked: false,
        expiresAt: { $gt: new Date() },
      });

      if (session) {
        const user = await User.findById(decoded.userId);

        if (user && user.isActive) {
          req.user = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt,
          };
          req.userId = user._id.toString();
          req.sessionId = decoded.sessionId;
        }
      }
    } catch (error) {
      // Ignore token errors for optional auth
      logger.warn("Optional auth token verification failed:", error);
    }

    next();
  } catch (error) {
    next();
  }
};

// Legacy export for backward compatibility
export const authenticate = authMiddleware;
