import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { GeneralSettings } from "@/models/cms";

class GeneralSettingsController {
  /**
   * Get general settings
   * @route GET /api/v1/general-settings
   * @access Public
   */
  getGeneralSettings = asyncHandler(async (req: Request, res: Response) => {
    let settings = await GeneralSettings.findOne({
      isDeleted: { $ne: true },
    })
    .select("-__v -isDeleted -deletedAt -createdBy -updatedBy")
    .lean();

    res.apiSuccess({ settings }, "General settings retrieved successfully");
  });
}

export const generalSettingsController = new GeneralSettingsController();
