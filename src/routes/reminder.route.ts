import express from "express";
import * as reminderController from "../controllers/reminder.controller";
import { authenticate } from "@/middleware/auth";

const router = express.Router();

router.post(
  "/",
  authenticate,
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

export default router;