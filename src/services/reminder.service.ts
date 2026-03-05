
import { Reminders } from "@/models/core/reminder.model";
import mongoose from "mongoose";

export const createReminder = async (data: any) => {
  return Reminders.create(data);
};

export const updateReminder = async (
  reminderId: string,
  userId: string,
  data: any
) => {
  return Reminders.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(reminderId),
      reminderSetBy: new mongoose.Types.ObjectId(userId),
    },
    data,
    { new: true }
  );
};

export const getReminders = async (userId: string) => {
  return Reminders.find({
    reminderSetBy: new mongoose.Types.ObjectId(userId),
  })
    .sort({ createdAt: -1 })
    .lean();
};

export const deleteReminder = async (reminderId: string, userId: string) => {
  return Reminders.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(reminderId),
    reminderSetBy: new mongoose.Types.ObjectId(userId),
  });
};

export const toggleReminderStatus = async (
  reminderId: string,
  userId: string
) => {
  const reminder = await Reminders.findOne({
    _id: reminderId,
    reminderSetBy: userId,
  });

  if (!reminder) return null;

  reminder.isActive = !reminder.isActive;
  await reminder.save();

  return reminder;
};