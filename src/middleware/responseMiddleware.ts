import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@/types';

// Extend Response interface to include our custom methods
declare global {
  namespace Express {
    interface Response {
      apiSuccess: <T>(data?: T, message?: string, statusCode?: number) => void;
      apiCreated: <T>(data?: T, message?: string) => void;
      apiNoContent: (message?: string) => void;
      apiPaginated: <T>(
        data: T[],
        pagination: { page: number; limit: number; total: number; pages: number },
        message?: string
      ) => void;
      apiError: (message?: string, statusCode?: number, error?: string) => void;
      apiValidationError: (message?: string, errors?: any[]) => void;
      apiNotFound: (message?: string) => void;
      apiUnauthorized: (message?: string) => void;
      apiForbidden: (message?: string) => void;
      apiConflict: (message?: string) => void;
      apiBadRequest: (message?: string, errors?: any[]) => void;
    }
  }
}

// Response middleware to add custom methods to response object
export const responseMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Success responses
  res.apiSuccess = <T>(
    data?: T,
    message: string = 'Success',
    statusCode: number = 200
  ): void => {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data
    };
    res.status(statusCode).json(response);
  };

  res.apiCreated = <T>(
    data?: T,
    message: string = 'Resource created successfully'
  ): void => {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data
    };
    res.status(201).json(response);
  };

  res.apiNoContent = (message: string = 'No content'): void => {
    const response: ApiResponse = {
      success: true,
      message
    };
    res.status(204).json(response);
  };

  res.apiPaginated = <T>(
    data: T[],
    pagination: { page: number; limit: number; total: number; pages: number },
    message: string = 'Data retrieved successfully'
  ): void => {
    const response: ApiResponse<T[]> = {
      success: true,
      message,
      data,
      pagination
    };
    res.status(200).json(response);
  };

  // Error responses
  res.apiError = (
    message: string = 'Internal Server Error',
    statusCode: number = 500,
    error?: string
  ): void => {
    const response: ApiResponse = {
      success: false,
      message,
      error
    };
    res.status(statusCode).json(response);
  };

  res.apiValidationError = (
    message: string = 'Validation failed',
    errors?: any[]
  ): void => {
    const response: ApiResponse = {
      success: false,
      message,
      error: errors
    };
    res.status(422).json(response);
  };

  res.apiNotFound = (message: string = 'Resource not found'): void => {
    const response: ApiResponse = {
      success: false,
      message
    };
    res.status(404).json(response);
  };

  res.apiUnauthorized = (message: string = 'Unauthorized access'): void => {
    const response: ApiResponse = {
      success: false,
      message
    };
    res.status(401).json(response);
  };

  res.apiForbidden = (message: string = 'Access forbidden'): void => {
    const response: ApiResponse = {
      success: false,
      message
    };
    res.status(403).json(response);
  };

  res.apiConflict = (message: string = 'Resource conflict'): void => {
    const response: ApiResponse = {
      success: false,
      message
    };
    res.status(409).json(response);
  };

  res.apiBadRequest = (
    message: string = 'Bad request',
    errors?: any[]
  ): void => {
    const response: ApiResponse = {
      success: false,
      message,
      error: errors
    };
    res.status(400).json(response);
  };

  next();
};