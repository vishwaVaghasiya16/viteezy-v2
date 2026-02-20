import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { contactService } from "@/services/contactService";
import { getPaginationOptions, getPaginationMeta } from "@/utils/pagination";

/**
 * Admin: List all contact inquiries with pagination and optional search
 * GET /api/v1/admin/contacts?page=1&limit=10&search=...
 */
export const listContacts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page, limit, sort } = getPaginationOptions(req);
  const { search } = req.query as { search?: string };

  const { items, total, page: p, limit: l } = await contactService.listContactInquiries({
    page,
    limit,
    sort,
    search,
  });

  const pagination = getPaginationMeta(p, l, total);
  res.apiPaginated(items, pagination, "Contact inquiries retrieved");
});

/**
 * Admin: Get single contact inquiry by ID
 * GET /api/v1/admin/contacts/:id
 */
export const getContactById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const inquiry = await contactService.getContactById(id);
  res.apiSuccess({ inquiry }, "Contact inquiry retrieved successfully");
});

export const adminContactController = {
  listContacts,
  getContactById,
};
