import express from "express";
import * as reminderController from "../controllers/reminder.controller";
import { authenticate } from "@/middleware/auth";
import { validateJoi } from "@/middleware/joiValidation";
import {
  createReminderValidation,
  updateReminderValidation,
  bulkCreateRemindersValidation
} from "@/validation/reminder.validation";

const router = express.Router();

router.post(
  "/",
  authenticate,
  validateJoi(createReminderValidation),
  reminderController.createReminder
);

router.get(
  "/",
  authenticate,
  reminderController.getReminders
);

router.patch(
  "/:id",
  authenticate,
  validateJoi(updateReminderValidation),
  reminderController.updateReminder
);

router.delete(
  "/:id",
  authenticate,
  reminderController.deleteReminder
);

router.patch(
  "/:id/toggle",
  authenticate,
  reminderController.toggleReminderStatus
);

router.post(
  "/bulk",
  authenticate,
  validateJoi(bulkCreateRemindersValidation),
  reminderController.bulkCreateReminders
);

router.get(
  "/:id/history",
  authenticate,
  reminderController.getReminderHistory
);

export default router;
