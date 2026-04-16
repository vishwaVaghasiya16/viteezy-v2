import { ReminderHistory } from "../models/core/reminderHistory.model";
import { ReminderHistoryEventType, ReminderTriggeredBy } from "../models/enums";
import mongoose from "mongoose";

export interface LogPayload {
  reminderId: string | mongoose.Types.ObjectId;
  userId: string | mongoose.Types.ObjectId;
  eventType: ReminderHistoryEventType;
  oldValue?: any;
  newValue?: any;
  triggeredBy?: ReminderTriggeredBy;
}

/**
 * Reminder History Service
 * Handles the logic for generating human-readable audit logs.
 */
class ReminderHistoryService {
  /**
   * Log a reminder action
   */
  async log(payload: LogPayload): Promise<void> {
    const { reminderId, userId, eventType, oldValue, newValue, triggeredBy = ReminderTriggeredBy.USER } = payload;

    const message = this.generateMessage(eventType, oldValue, newValue);

    await ReminderHistory.create({
      reminderId,
      userId,
      eventType,
      oldValue,
      newValue,
      message,
      triggeredBy,
    });
  }

  /**
   * Generate human-readable audit messages based on state changes
   */
  private generateMessage(eventType: ReminderHistoryEventType, oldValue: any, newValue: any): string {
    switch (eventType) {
      case ReminderHistoryEventType.CREATED:
        return `Reminder created for ${newValue?.time || "unknown time"} (${newValue?.frequency || "Daily"}).`;

      case ReminderHistoryEventType.TIME_UPDATED:
        return `Time updated from ${oldValue?.time || "N/A"} to ${newValue?.time || "N/A"}.`;

      case ReminderHistoryEventType.DATE_FREQUENCY_CHANGED:
        return `Frequency changed from ${oldValue?.frequency || "N/A"} to ${newValue?.frequency || "N/A"}.`;

      case ReminderHistoryEventType.MESSAGE_UPDATED:
        return `Note updated from "${this.truncate(oldValue?.note)}" to "${this.truncate(newValue?.note)}".`;

      case ReminderHistoryEventType.ENABLED:
        return `Reminder enabled.`;

      case ReminderHistoryEventType.DISABLED:
        return `Reminder disabled.`;

      case ReminderHistoryEventType.DELETED:
        return `Reminder removed.`;

      case ReminderHistoryEventType.MULTIPLE_ADDED:
        return `Multiple reminders added in bulk.`;

      default:
        return `Action: ${eventType}`;
    }
  }

  private truncate(str: string, length: number = 50): string {
    if (!str) return "";
    return str.length > length ? str.substring(0, length) + "..." : str;
  }
}

export const reminderHistoryService = new ReminderHistoryService();
