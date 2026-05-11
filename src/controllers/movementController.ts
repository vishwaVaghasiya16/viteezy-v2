import { Request, Response, NextFunction } from "express";
import { movementService } from "../services/movement.service";
import { inventoryService } from "../services/inventory.service";
import {
  CreateMovementDto,
  MovementFilterDto,
} from "../types/inventory.types";
import { AppError } from "@/utils";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

// MOVEMENT CONTROLLER

class MovementController {
  // POST /api/inventory/movements
  async create(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const dto: CreateMovementDto = req.body;

      const performedBy = req.user?.id || req.userId;

      if (!performedBy) {
        throw new AppError("Unauthorized", 401);
      }

      const result = await movementService.createMovement(
        dto,
        performedBy
      );

      res.apiCreated(
        result,
        "Inventory movement recorded successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/inventory/movements
  async list(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const filters =
        req.query as unknown as MovementFilterDto;

      const { data, pagination } =
        await inventoryService.getMovementHistory(filters);
      res.apiPaginated(data, pagination, "Movements retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  // GET /api/inventory/movements/:movementId
  async getOne(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const movement =
        await inventoryService.getMovementById(
          req.params.movementId
        );

      res.apiSuccess(
        movement,
        "Movement details retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  // GET /api/inventory/locations/:locationId/movements
  async getByLocation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { locationId } = req.params;
      const filters = req.query as unknown as MovementFilterDto;

      // Force location filter
      const { data, pagination } = await inventoryService.getMovementHistory({
        ...filters,
        locationId,
      });

      res.apiPaginated(
        data,
        pagination,
        `Movements for location ${locationId} retrieved successfully`
      );
    } catch (error) {
      next(error);
    }
  }
}

export const movementController = new MovementController();