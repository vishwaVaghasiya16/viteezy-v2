import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { States } from "@/models/core/states.model";
import { Countries } from "@/models/core/countries.model";
import mongoose from "mongoose";
import { AppError } from "@/utils/AppError";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

class StateController {
  /**
   * Get all states
   * @route GET /api/v1/states
   * @access Public
   */
  getAllStates = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { countryCode, countryId, isActive, search } = req.query;

      const query: any = { isDeleted: false };

      if (countryCode) {
        query.countryCode = (countryCode as string).toUpperCase();
      }

      if (countryId) {
        if (!mongoose.Types.ObjectId.isValid(countryId as string)) {
          throw new AppError("Invalid country ID format", 400);
        }
        query.countryId = new mongoose.Types.ObjectId(countryId as string);
      }

      if (isActive !== undefined) {
        query.isActive = isActive === "true";
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { code: { $regex: search, $options: "i" } },
        ];
      }

      const states = await States.find(query)
        .populate("countryId", "name alpha2 alpha3")
        .select("name code countryId countryCode type isActive")
        .sort({ name: 1 })
        .lean();

      res.apiSuccess({ states }, "States retrieved successfully");
    }
  );

  /**
   * Get states by country code
   * @route GET /api/v1/states/country/:countryCode
   * @access Public
   */
  getStatesByCountryCode = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { countryCode } = req.params;

      // Verify country exists
      const country = await Countries.findOne({
        alpha2: countryCode.toUpperCase(),
        isDeleted: false,
        isActive: true,
      }).lean();

      if (!country) {
        throw new AppError("Country not found", 404);
      }

      const states = await States.find({
        countryCode: countryCode.toUpperCase(),
        isDeleted: false,
        isActive: true,
      })
        .select("name code type")
        .sort({ name: 1 })
        .lean();

      res.apiSuccess(
        { country: { name: country.name, code: country.alpha2 }, states },
        "States retrieved successfully"
      );
    }
  );

  /**
   * Get state by code
   * @route GET /api/v1/states/:code
   * @access Public
   */
  getStateByCode = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { code, countryCode } = req.query;

      if (!code || typeof code !== "string") {
        throw new AppError("State code is required", 400);
      }

      const query: any = {
        code: code.toUpperCase(),
        isDeleted: false,
      };

      if (countryCode && typeof countryCode === "string") {
        query.countryCode = countryCode.toUpperCase();
      }

      const state = await States.findOne(query)
        .populate("countryId", "name alpha2 alpha3")
        .select("name code countryId countryCode type isActive")
        .lean();

      if (!state) {
        res.apiNotFound("State not found");
        return;
      }

      res.apiSuccess({ state }, "State retrieved successfully");
    }
  );
}

const stateController = new StateController();
export { stateController as StateController };
