import { Request, Response, NextFunction } from "express";
import { Locations } from "@/models/inventory/location.model";
import {
  CreateLocationDto,
  UpdateLocationDto,
  LocationFilterDto,
} from "../types/inventory.types";
import { AppError } from "@/utils/AppError";

/**
 * LocationController
 * Handles CRUD for physical/virtual inventory locations.
 */

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

class LocationController {
  // POST /api/inventory/locations
  async create(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const dto: CreateLocationDto = req.body;

      const existing = await Locations.findOne({
        name: dto.name.toLowerCase().trim(),
        type: dto.type,
        isDeleted: false,
      });

      if (existing) {
        throw new AppError(
          `A location named "${dto.name}" of type "${dto.type}" already exists`,
          409
        );
      }

      const location = await Locations.create({
        ...dto,
        createdBy: req.user?.id || req.userId || null,
      });

      res.apiCreated(location, "Location created successfully");
    } catch (error) {
      next(error);
    }
  }

  // GET /api/inventory/locations
  async list(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        type,
        isActive,
        search,
        page = 1,
        limit = 20,
      } = req.query as unknown as LocationFilterDto;

      const filter: Record<string, any> = {
        isDeleted: false,
      };

      if (type) filter.type = type;

      if (isActive !== undefined) {
        filter.isActive = isActive;
      }

      if (search) {
        filter.$or = [
          {
            name: {
              $regex: search,
              $options: "i",
            },
          },
          {
            "contactPerson.name": {
              $regex: search,
              $options: "i",
            },
          },
        ];
      }

      const skip =
        (Number(page) - 1) * Number(limit);

      const [data, total] = await Promise.all([
        Locations.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),

        Locations.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(
        total / Number(limit)
      );

      res.apiPaginated(
        data,
        {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: totalPages,
        },
        "Locations retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/inventory/locations/:id
  async getOne(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const location = await Locations.findOne({
        _id: req.params.locationId,
        isDeleted: false,
      }).lean();

      if (!location) {
        throw new AppError(
          "Location not found",
          404
        );
      }

      res.apiSuccess(
        location,
        "Location details retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/inventory/locations/:id
  async update(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const dto: UpdateLocationDto = req.body;

      const location =
        await Locations.findOneAndUpdate(
          {
            _id: req.params.locationId,
            isDeleted: false,
          },
          {
            $set: {
              ...dto,
              updatedBy:
                req.user?.id ||
                req.userId ||
                null,
            },
          },
          {
            new: true,
            runValidators: true,
          }
        ).lean();

      if (!location) {
        throw new AppError(
          "Location not found",
          404
        );
      }

      res.apiSuccess(
        location,
        "Location updated successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/inventory/locations/:id
  async remove(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const location =
        await Locations.findOneAndUpdate(
          {
            _id: req.params.locationId,
            isDeleted: false,
          },
          {
            $set: {
              isDeleted: true,
              isActive: false,
              deletedAt: new Date(),
              updatedBy:
                req.user?.id ||
                req.userId ||
                null,
            },
          },
          { new: true }
        ).lean();

      if (!location) {
        throw new AppError(
          "Location not found",
          404
        );
      }

      res.apiSuccess(
        null,
        "Location deleted successfully"
      );
    } catch (error) {
      next(error);
    }
  }
}

export const locationController =
  new LocationController();