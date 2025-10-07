import { Request } from "express";
import { PaginationQuery } from "@/types";
import { PAGINATION } from "@/constants";

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
}

export const getPaginationOptions = (req: Request): PaginationOptions => {
  const page = Math.max(
    1,
    parseInt(req.query.page as string) || PAGINATION.DEFAULT_PAGE
  );
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, parseInt(req.query.limit as string) || PAGINATION.DEFAULT_LIMIT)
  );
  const skip = (page - 1) * limit;

  // Sort options
  const sortField = (req.query.sort as string) || "createdAt";
  const sortOrder = (req.query.order as string) === "asc" ? 1 : -1;
  const sort: Record<string, 1 | -1> = { [sortField]: sortOrder };

  return { page, limit, skip, sort };
};

export const getPaginationMeta = (
  page: number,
  limit: number,
  total: number
) => {
  const pages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1,
  };
};
