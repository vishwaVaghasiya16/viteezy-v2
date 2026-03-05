import { Request, Response } from "express";
import * as reminderService from "../services/reminder.service";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "@/utils";

export const createReminder = asyncHandler(
  async (req: any, res: Response) => {
    const userId = req.userId;

    const reminder = await reminderService.createReminder({
      reminderSetBy: userId,
      time: req.body.time,
      note: req.body.note,
    });

    res.apiSuccess(reminder, "Reminder created successfully");
  }
);

export const updateReminder = asyncHandler(
  async (req: any, res: Response) => {
    const userId = req.userId;

    const reminder = await reminderService.updateReminder(
      req.params.id,
      userId,
      req.body
    );

    if (!reminder) throw new AppError("Reminder not found", 404);

    res.apiSuccess(reminder, "Reminder updated successfully");
  }
);

export const getReminders = asyncHandler(
  async (req: any, res: Response) => {
    const userId = req.userId;

    const reminders = await reminderService.getReminders(userId);

    res.apiSuccess({ reminders }, "Reminders retrieved successfully");
  }
);

export const deleteReminder = asyncHandler(
  async (req: any, res: Response) => {
    const userId = req.userId;

    const reminder = await reminderService.deleteReminder(
      req.params.id,
      userId
    );

    if (!reminder) throw new AppError("Reminder not found", 404);

    res.apiSuccess({}, "Reminder deleted successfully");
  }
);

export const toggleReminderStatus = asyncHandler(
  async (req: any, res: Response) => {
    const userId = req.userId;

    const reminder = await reminderService.toggleReminderStatus(
      req.params.id,
      userId
    );

    if (!reminder) throw new AppError("Reminder not found", 404);

    res.apiSuccess(reminder, "Reminder status updated");
  }
);