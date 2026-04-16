import { Request, Response } from "express";
import * as reminderService from "../services/reminder.service";
import { ReminderHistory } from "@/models/core/reminderHistory.model";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "@/utils";

export const createReminder = asyncHandler(
  async (req: any, res: Response) => {
    const userId = req.userId;

    const reminder = await reminderService.createReminder({
      reminderSetBy: userId,
      time: req.body.time,
      note: req.body.note,
      frequency: req.body.frequency,
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

/**
 * GET /api/reminders/:id/history
 */
export const getReminderHistory = asyncHandler(
  async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.userId;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = parseInt(req.query.skip as string) || 0;

    const history = await ReminderHistory.find({
      reminderId: id,
      userId
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

    const total = await ReminderHistory.countDocuments({ reminderId: id, userId });

    res.apiSuccess({
      reminderId: id,
      history: history.map(h => ({
        eventType: h.eventType,
        message: h.message,
        createdAt: h.createdAt,
        triggeredBy: h.triggeredBy,
        oldValue: h.oldValue,
        newValue: h.newValue
      })),
      pagination: {
        total,
        limit,
        skip,
        hasMore: total > skip + limit
      }
    }, "Reminder history retrieved successfully");
  }
);

/**
 * POST /api/reminders/bulk
 */
export const bulkCreateReminders = asyncHandler(
  async (req: any, res: Response) => {
    const userId = req.userId;
    const { reminders } = req.body;

    if (!Array.isArray(reminders)) {
      throw new AppError("Reminders must be an array", 400);
    }

    const created = await reminderService.bulkCreateReminders(userId, reminders);

    res.apiSuccess(created, `Successfully created ${created.length} reminders`);
  }
);
