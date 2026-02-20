import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import { adminContactController } from "@/controllers/adminContactController";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * GET /api/v1/admin/contacts
 * List contact inquiries (paginated, optional search)
 * Query: page, limit, search
 */
router.get("/", adminContactController.listContacts);

/**
 * GET /api/v1/admin/contacts/:id
 * Get single contact inquiry by ID
 */
router.get("/:id", adminContactController.getContactById);

export default router;
