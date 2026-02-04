/**
 * @fileoverview Membership CMS Controller
 * @description Controller for user-facing Membership CMS operations (read-only)
 * @module controllers/membershipCmsController
 */

import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { MembershipCms } from "@/models/cms";

class MembershipCmsController {
  /**
   * Get active Membership CMS entry
   * @route GET /api/v1/membership-cms
   * @access Public
   * @note Since there's only one Membership CMS record, this returns the single active record
   */
  getActiveMembershipCms = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const membershipCms = await MembershipCms.findOne({
        isActive: true,
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .lean();

      if (!membershipCms) {
        throw new AppError("Active Membership CMS not found", 404);
      }

      res.apiSuccess(
        { membershipCms },
        "Membership CMS retrieved successfully"
      );
    }
  );
}

export const membershipCmsController = new MembershipCmsController();

