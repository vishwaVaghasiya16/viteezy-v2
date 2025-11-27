import { Router } from "express";
import { exampleController } from "@/controllers/exampleController";
import { validateQuery, validateParams } from "@/middleware/joiValidation";
import {
  getErrorExampleQuerySchema,
  deleteExampleParamsSchema,
} from "@/validation/exampleValidation";

const router = Router();

// Routes
router.get("/simple", exampleController.getSimpleData);

router.get("/paginated", exampleController.getPaginatedData);

router.post("/create", exampleController.createData);

router.get(
  "/error",
  validateQuery(getErrorExampleQuerySchema),
  exampleController.getErrorExample
);

router.get("/complex", exampleController.getComplexData);

router.delete(
  "/:id",
  validateParams(deleteExampleParamsSchema),
  exampleController.deleteData
);

export default router;
