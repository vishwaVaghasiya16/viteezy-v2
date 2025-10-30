import { Request } from "express";

// Extended Request interface with custom properties
export interface ApiRequest extends Request {
  user?: any;
  userId?: string;
  pagination?: {
    page: number;
    limit: number;
    skip: number;
    sort: Record<string, 1 | -1>;
  };
  filters?: Record<string, any>;
  search?: string;
}

// Standard API Response interface
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  errorType?: string;
  data?: T;
  error?: string | any[];
  pagination?: PaginationMeta;
  meta?: {
    timestamp: string;
    requestId?: string;
    version?: string;
  };
}

// Pagination metadata
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// API Error interface
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  field?: string;
}

// Validation error interface
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code?: string;
}

// Success response data
export interface SuccessResponse<T = any> {
  data: T;
  message: string;
  statusCode: number;
}

// Paginated response data
export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: PaginationMeta;
  message: string;
  statusCode: number;
}

// API endpoint configuration
export interface ApiEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  handler: Function;
  middleware?: Function[];
  validation?: any[];
  description?: string;
  tags?: string[];
  responses?: {
    [statusCode: number]: {
      description: string;
      schema?: any;
    };
  };
}

// API version configuration
export interface ApiVersion {
  version: string;
  basePath: string;
  endpoints: ApiEndpoint[];
  middleware?: Function[];
}

// Request context
export interface RequestContext {
  requestId: string;
  userId?: string;
  ip: string;
  userAgent: string;
  timestamp: Date;
  method: string;
  url: string;
}

// Response metadata
export interface ResponseMetadata {
  requestId: string;
  processingTime: number;
  timestamp: string;
  version: string;
  environment: string;
}
