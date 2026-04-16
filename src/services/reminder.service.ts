
import { Reminders, IReminder } from "@/models/core/reminder.model";
import { reminderHistoryService } from "./reminderHistory.service";
import { ReminderHistoryEventType, ReminderTriggeredBy } from "@/models/enums";
import mongoose from "mongoose";

export const createReminder = async (data: any, triggeredBy: ReminderTriggeredBy = ReminderTriggeredBy.USER) => {
  const reminder = await Reminders.create(data);
  
  await reminderHistoryService.log({
    reminderId: reminder._id as string,
    userId: reminder.reminderSetBy,
    eventType: ReminderHistoryEventType.CREATED,
    newValue: reminder.toObject(),
    triggeredBy
  });

  return reminder;
};

export const updateReminder = async (
  reminderId: string,
  userId: string,
  data: any,
  triggeredBy: ReminderTriggeredBy = ReminderTriggeredBy.USER
) => {
  const oldReminder = await Reminders.findOne({
    _id: reminderId,
    reminderSetBy: userId,
    isDeleted: false
  });

  if (!oldReminder) return null;

  const oldValues = oldReminder.toObject();
  
  const updatedReminder = await Reminders.findOneAndUpdate(
    { _id: reminderId, reminderSetBy: userId, isDeleted: false },
    data,
    { new: true }
  );

  if (updatedReminder) {
    const newValues = updatedReminder.toObject();
    
    // Log individual events based on what changed
    if (data.time && data.time !== oldValues.time) {
      await reminderHistoryService.log({
        reminderId, userId, eventType: ReminderHistoryEventType.TIME_UPDATED,
        oldValue: { time: oldValues.time }, newValue: { time: newValues.time }, triggeredBy
      });
    }

    if (data.frequency && data.frequency !== oldValues.frequency) {
      await reminderHistoryService.log({
        reminderId, userId, eventType: ReminderHistoryEventType.DATE_FREQUENCY_CHANGED,
        oldValue: { frequency: oldValues.frequency }, newValue: { frequency: newValues.frequency }, triggeredBy
      });
    }

    if (data.note !== undefined && data.note !== oldValues.note) {
      await reminderHistoryService.log({
        reminderId, userId, eventType: ReminderHistoryEventType.MESSAGE_UPDATED,
        oldValue: { note: oldValues.note }, newValue: { note: newValues.note }, triggeredBy
      });
    }
  }

  return updatedReminder;
};

export const getReminders = async (userId: string) => {
  return Reminders.find({
    reminderSetBy: new mongoose.Types.ObjectId(userId),
    isDeleted: false
  })
    .sort({ createdAt: -1 })
    .lean();
};

export const deleteReminder = async (reminderId: string, userId: string, triggeredBy: ReminderTriggeredBy = ReminderTriggeredBy.USER) => {
  const reminder = await Reminders.findOneAndUpdate(
    { _id: reminderId, reminderSetBy: userId, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );

  if (reminder) {
    await reminderHistoryService.log({
      reminderId, userId, eventType: ReminderHistoryEventType.DELETED, triggeredBy
    });
  }

  return reminder;
};

export const toggleReminderStatus = async (
  reminderId: string,
  userId: string,
  triggeredBy: ReminderTriggeredBy = ReminderTriggeredBy.USER
) => {
  const reminder = await Reminders.findOne({
    _id: reminderId,
    reminderSetBy: userId,
    isDeleted: false
  });

  if (!reminder) return null;

  reminder.isActive = !reminder.isActive;
  await reminder.save();

  await reminderHistoryService.log({
    reminderId,
    userId,
    eventType: reminder.isActive ? ReminderHistoryEventType.ENABLED : ReminderHistoryEventType.DISABLED,
    triggeredBy
  });

  return reminder;
};

export const bulkCreateReminders = async (
  userId: string,
  remindersData: any[]
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const formattedData = remindersData.map(r => ({
      ...r,
      reminderSetBy: userId,
    }));

    // Step 1: Fetch existing reminders in ONE query (optimized)
    const existingReminders = await Reminders.find({
      reminderSetBy: userId,
      isDeleted: false,
      $or: formattedData.map(r => ({
        time: r.time,
        note: r.note,
        frequency: r.frequency,
      })),
    }).lean();

    // Convert existing to a Set for fast lookup
    const existingSet = new Set(
      existingReminders.map(r => `${r.time}-${r.note}-${r.frequency}`)
    );

    // Step 2: Filter unique reminders
    const uniqueReminders = formattedData.filter(r => {
      const key = `${r.time}-${r.note}-${r.frequency}`;
      return !existingSet.has(key);
    });

    // If nothing new
    if (uniqueReminders.length === 0) {
      await session.abortTransaction();
      return [];
    }

    // Step 3: Insert only unique reminders
    const createdReminders = await Reminders.insertMany(uniqueReminders, {
      session,
    });

    // Step 4: Log individual CREATED events
    for (const reminder of createdReminders) {
      await reminderHistoryService.log({
        reminderId: reminder._id as string,
        userId,
        eventType: ReminderHistoryEventType.CREATED,
        newValue: reminder.toObject(),
        triggeredBy: ReminderTriggeredBy.USER,
      });
    }

    // Step 5: Log bulk summary
    await reminderHistoryService.log({
      reminderId: createdReminders[0]._id as string, // Reference the first created reminder for context
      userId,
      eventType: ReminderHistoryEventType.MULTIPLE_ADDED,
      newValue: { count: createdReminders.length },
      triggeredBy: ReminderTriggeredBy.USER,
    });

    await session.commitTransaction();
    return createdReminders;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};