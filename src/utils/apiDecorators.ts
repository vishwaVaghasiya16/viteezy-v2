import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@/types';

/**
 * Async wrapper to catch errors in async route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Response wrapper for consistent API responses
 */
export const responseWrapper = (fn: Function) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await fn(req, res, next);

      // If response is already sent, don't send again
      if (res.headersSent) {
        return;
      }

      // If result is an ApiResponse, send it directly
      if (result && typeof result === 'object' && 'success' in result) {
        res.json(result);
        return;
      }

      // Otherwise, wrap in success response
      res.apiSuccess(result);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Pagination wrapper for paginated responses
 */
export const paginationWrapper = (fn: Function) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await fn(req, res, next);

      if (res.headersSent) {
        return;
      }

      // If result has pagination data, use paginated response
      if (result && result.data && result.pagination) {
        res.apiPaginated(
          result.data,
          result.pagination,
          result.message || 'Data retrieved successfully'
        );
        return;
      }

      // Otherwise, use regular success response
      res.apiSuccess(result);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validation wrapper for input validation
 */
export const validationWrapper = (validationRules: any[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: any[] = [];

    validationRules.forEach(rule => {
      const result = rule.run(req);
      if (!result.isEmpty()) {
        errors.push(...result.array());
      }
    });

    if (errors.length > 0) {
      res.apiValidationError('Validation failed', errors);
      return;
    }

    next();
  };
};

/**
 * Rate limiting wrapper
 */
export const rateLimitWrapper = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    for (const [ip, data] of requests.entries()) {
      if (data.resetTime < windowStart) {
        requests.delete(ip);
      }
    }

    const userRequests = requests.get(key);

    if (!userRequests) {
      requests.set(key, { count: 1, resetTime: now });
      return next();
    }

    if (userRequests.count >= maxRequests) {
      return res.apiError('Too many requests', 429);
    }

    userRequests.count++;
    next();
  };
};

/**
 * Cache wrapper for response caching
 */
export const cacheWrapper = (ttl: number = 300) => {
  const cache = new Map<string, { data: any; expiry: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.method}:${req.originalUrl}`;
    const cached = cache.get(key);

    if (cached && cached.expiry > Date.now()) {
      res.json(cached.data);
      return;
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function (data: any) {
      cache.set(key, { data, expiry: Date.now() + ttl * 1000 });
      return originalJson.call(this, data);
    };

    next();
  };
};
