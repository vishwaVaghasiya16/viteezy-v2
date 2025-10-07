import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@/types';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const response: ApiResponse = {
    success: false,
    message: `Route ${req.originalUrl} not found`,
    error: 'Not Found'
  };

  res.status(404).json(response);
};
