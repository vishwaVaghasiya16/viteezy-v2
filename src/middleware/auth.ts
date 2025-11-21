/**
 * @fileoverview Authentication and Authorization Middleware
 * @description Middleware for JWT token authentication, session validation, and role-based authorization
 * @module middleware/auth
 */

import jwt, { JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { User, AuthSessions } from "@/models/index.model";
import { AppError } from "@/utils/AppError";
import { logger } from "@/utils/logger";
import { config } from "@/config";
import { HTTP_STATUS } from "@/constants";

/**
 * JWT Payload Interface
 * @interface JWTPayload
 * @extends JwtPayload
 * @description Extended JWT payload with user and session information
 */
interface JWTPayload extends JwtPayload {
  /** User ID from the token */
  userId: string;
  /** Session ID from the token */
  sessionId: string;
}

/**
 * Authenticated Request Interface
 * @interface AuthenticatedRequest
 * @extends Request
 * @description Extended Express Request with authenticated user data
 */
interface AuthenticatedRequest extends Request {
  /** Authenticated user object */
  user?: any;
  /** User ID from authentication token */
  userId?: string;
  /** Session ID from authentication token */
  sessionId?: string;
}

/**
 * Extract user data from user document
 * @function extractUserData
 * @description Extracts user data from MongoDB user document
 * @param {any} user - User document from database
 * @returns {object} User data object
 */
const extractUserData = (user: any): object => {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    avatar: user.avatar,
    profileImage: user.profileImage,
    gender: user.gender,
    age: user.age,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
  };
};

/**
 * Verify and decode JWT token
 * @function verifyToken
 * @description Verifies JWT token and returns decoded payload
 * @param {string} token - JWT token to verify
 * @returns {JWTPayload} Decoded JWT payload
 * @throws {AppError} If token is invalid or expired
 */
const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, config.jwt.secret) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError(
        "Invalid token",
        HTTP_STATUS.UNAUTHORIZED,
        true,
        "AuthenticationError"
      );
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(
        "Token expired",
        HTTP_STATUS.UNAUTHORIZED,
        true,
        "AuthenticationError"
      );
    }
    throw new AppError(
      "Token verification failed",
      HTTP_STATUS.UNAUTHORIZED,
      true,
      "AuthenticationError"
    );
  }
};

/**
 * Validate session from database
 * @async
 * @function validateSession
 * @description Validates session existence and expiration
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @returns {Promise<any>} Session document if valid
 * @throws {AppError} If session is invalid or expired
 */
const validateSession = async (
  sessionId: string,
  userId: string
): Promise<any> => {
  const session = await AuthSessions.findOne({
    sessionId,
    userId,
    expiresAt: { $gt: new Date() },
    isRevoked: { $ne: true },
  });

  if (!session) {
    throw new AppError(
      "Invalid or expired session",
      HTTP_STATUS.UNAUTHORIZED,
      true,
      "AuthenticationError"
    );
  }

  return session;
};

/**
 * Update session last used timestamp
 * @async
 * @function updateSessionLastUsed
 * @description Updates session's last used timestamp
 * @param {string} sessionId - Session ID
 * @returns {Promise<void>}
 */
const updateSessionLastUsed = async (sessionId: string): Promise<void> => {
  await AuthSessions.findByIdAndUpdate(sessionId, {
    lastUsedAt: new Date(),
  });
};

/**
 * Authentication Middleware
 * @async
 * @function authMiddleware
 * @description Authenticates requests using JWT tokens and session validation
 * Validates token, checks session, verifies user, and attaches user data to request
 * @param {AuthenticatedRequest} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 * @throws {AppError} If authentication fails
 * @example
 * ```typescript
 * router.get('/protected', authMiddleware, protectedController);
 * ```
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract authorization header
    const authHeader = req.headers.authorization;

    // Check if authorization header exists and has Bearer token
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(
        "Access token is required",
        HTTP_STATUS.UNAUTHORIZED,
        true,
        "AuthenticationError"
      );
    }

    // Extract token from authorization header (remove 'Bearer ' prefix)
    const token = authHeader.substring(7);

    // Verify and decode JWT token
    const decoded = verifyToken(token);

    // Validate session from database
    const session = await validateSession(decoded.sessionId, decoded.userId);

    // Get user from database
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.UNAUTHORIZED,
        true,
        "AuthenticationError"
      );
    }

    // Check if user account is active
    if (!user.isActive) {
      throw new AppError(
        "Account is deactivated",
        HTTP_STATUS.UNAUTHORIZED,
        true,
        "AuthenticationError"
      );
    }

    // Update session last used timestamp (async, don't wait)
    updateSessionLastUsed(session._id).catch((error) => {
      logger.warn("Failed to update session last used:", error);
    });

    // Attach user data to request object
    req.user = extractUserData(user);
    req.userId = user._id.toString();
    req.sessionId = decoded.sessionId;

    // Continue to next middleware
    next();
  } catch (error) {
    // Pass error to error handler middleware
    next(error);
  }
};

/**
 * Authorization Middleware Factory
 * @function authorize
 * @description Creates middleware that authorizes requests based on user roles
 * Must be used after authMiddleware to ensure user is authenticated
 * @param {...string} roles - Allowed user roles
 * @returns {Function} Express middleware function
 * @example
 * ```typescript
 * // Only admin and moderator can access
 * router.delete('/users/:id', authMiddleware, authorize('admin', 'moderator'), userController.delete);
 * ```
 */
export const authorize = (...roles: string[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    // Check if user is authenticated
    if (!req.user) {
      next(
        new AppError(
          "Authentication required",
          HTTP_STATUS.UNAUTHORIZED,
          true,
          "AuthenticationError"
        )
      );
      return;
    }

    // Check if user has required role
    if (!roles.includes(req.user.role)) {
      next(
        new AppError(
          "Insufficient permissions",
          HTTP_STATUS.FORBIDDEN,
          true,
          "AuthorizationError"
        )
      );
      return;
    }

    // User has required role, continue to next middleware
    next();
  };
};

/**
 * Optional Authentication Middleware
 * @async
 * @function optionalAuth
 * @description Authenticates request if token is provided, but doesn't throw error if token is missing
 * Useful for endpoints that work for both authenticated and unauthenticated users
 * @param {AuthenticatedRequest} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 * @example
 * ```typescript
 * // Endpoint works for both authenticated and unauthenticated users
 * router.get('/posts', optionalAuth, postController.list);
 * ```
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract authorization header
    const authHeader = req.headers.authorization;

    // If no authorization header, continue without authentication
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      next();
      return;
    }

    // Extract token from authorization header
    const token = authHeader.substring(7);

    try {
      // Verify and decode JWT token
      const decoded = verifyToken(token);

      // Validate session from database
      const session = await validateSession(decoded.sessionId, decoded.userId);

      if (session) {
        // Get user from database
        const user = await User.findById(decoded.userId);

        // Attach user data if user exists and is active
        if (user && user.isActive) {
          req.user = extractUserData(user);
          req.userId = user._id.toString();
          req.sessionId = decoded.sessionId;
        }
      }
    } catch (error) {
      // Ignore token errors for optional auth (don't throw, just log)
      logger.warn("Optional auth token verification failed:", error);
    }

    // Continue to next middleware (regardless of authentication result)
    next();
  } catch (error) {
    // Continue even if unexpected error occurs
    logger.warn("Optional auth error:", error);
    next();
  }
};

/**
 * Legacy export for backward compatibility
 * @deprecated Use authMiddleware instead
 * @see authMiddleware
 */
export const authenticate = authMiddleware;
