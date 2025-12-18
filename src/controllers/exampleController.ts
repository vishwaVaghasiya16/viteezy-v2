import { Request, Response } from "express";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";

class ExampleController {
  // Example: Simple success response
  getSimpleData = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const data = {
        message: "Hello from API!",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      };

      res.apiSuccess(data, "Data retrieved successfully");
    }
  );

  // Example: Paginated response
  getPaginatedData = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page, limit, skip, sort } = getPaginationOptions(req);

      // Mock data for demonstration
      const mockData = Array.from({ length: 50 }, (_, i) => ({
        _id: i + 1,
        name: `Item ${i + 1}`,
        description: `This is item number ${i + 1}`,
        createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      }));

      // Apply pagination
      const total = mockData.length;
      const paginatedData = mockData
        .sort((a, b) => {
          const field = Object.keys(sort)[0];
          const order = sort[field];
          return order === 1
            ? a[field as keyof typeof a] > b[field as keyof typeof b]
              ? 1
              : -1
            : a[field as keyof typeof a] < b[field as keyof typeof b]
            ? 1
            : -1;
        })
        .slice(skip, skip + limit);

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(
        paginatedData,
        pagination,
        "Paginated data retrieved successfully"
      );
    }
  );

  // Example: Created response
  createData = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { name, description } = req.body;

      // Mock creation
      const newItem = {
        _id: Math.floor(Math.random() * 1000),
        name,
        description,
        createdAt: new Date().toISOString(),
      };

      res.apiCreated(newItem, "Item created successfully");
    }
  );

  // Example: Error responses
  getErrorExample = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { type } = req.query;

      switch (type) {
        case "notfound":
          res.apiNotFound("Resource not found");
          break;
        case "unauthorized":
          res.apiUnauthorized("Access denied");
          break;
        case "forbidden":
          res.apiForbidden("You are not authorized to perform this action.");
          break;
        case "validation":
          res.apiValidationError("Validation failed", [
            { field: "email", message: "Email is required" },
            {
              field: "password",
              message: "Password must be at least 6 characters",
            },
          ]);
          break;
        case "conflict":
          res.apiConflict("Resource already exists");
          break;
        case "badrequest":
          res.apiBadRequest("Invalid request parameters");
          break;
        default:
          res.apiError("Internal server error", 500, "Something went wrong");
      }
    }
  );

  // Example: Complex response with metadata
  getComplexData = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const data = {
        users: [
          { _id: 1, name: "John Doe", email: "john@example.com" },
          { _id: 2, name: "Jane Smith", email: "jane@example.com" },
        ],
        statistics: {
          totalUsers: 2,
          activeUsers: 2,
          lastUpdated: new Date().toISOString(),
        },
        metadata: {
          requestId: req.headers["x-request-id"] || "unknown",
          processingTime: "50ms",
          version: "1.0.0",
        },
      };

      res.apiSuccess(data, "Complex data retrieved successfully");
    }
  );

  // Example: No content response
  deleteData = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      // Mock deletion
      console.log(`Deleting item with ID: ${id}`);

      res.apiNoContent("Item deleted successfully");
    }
  );
}

export const exampleController = new ExampleController();
