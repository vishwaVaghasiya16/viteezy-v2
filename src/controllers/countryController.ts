import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { Countries } from "@/models/core/countries.model";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

class CountryController {
  /**
   * Get all countries
   * @route GET /api/v1/countries
   * @access Public
   */
  getAllCountries = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { isActive, region, search } = req.query;

      const query: any = { isDeleted: false };

      if (isActive !== undefined) {
        query.isActive = isActive === "true";
      }

      if (region) {
        query.region = region;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { alpha2: { $regex: search, $options: "i" } },
          { alpha3: { $regex: search, $options: "i" } },
        ];
      }

      const countries = await Countries.find(query)
        .select("name alpha2 alpha3 numeric region subRegion isActive")
        .sort({ name: 1 })
        .lean();

      res.apiSuccess({ countries }, "Countries retrieved successfully");
    }
  );

  /**
   * Get country by code
   * @route GET /api/v1/countries/:code
   * @access Public
   */
  getCountryByCode = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { code } = req.params;

      const country = await Countries.findOne({
        $or: [
          { alpha2: code.toUpperCase() },
          { alpha3: code.toUpperCase() },
          { numeric: code },
        ],
        isDeleted: false,
      })
        .select("name alpha2 alpha3 numeric region subRegion isActive")
        .lean();

      if (!country) {
        res.apiNotFound("Country not found");
        return;
      }

      res.apiSuccess({ country }, "Country retrieved successfully");
    }
  );
}

const countryController = new CountryController();
export { countryController as CountryController };
