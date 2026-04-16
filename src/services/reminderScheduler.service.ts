import cron from "node-cron";
import moment from "moment";
import { Reminders } from "../models/core/reminder.model";
import { reminderNotificationService } from "@/utils/notificationHelpers";

export const startReminderScheduler = async (): Promise<void> => {
  cron.schedule("* * * * *", async () => {
    try {
      const currentTime = moment().format("hh:mm A");
      console.log({currentTime});
      console.log("🔄 [CRON] Reminder scheduler triggered");

      const reminders = await Reminders.find({
        time: currentTime,
        isActive: true
      }).lean();
      for (const reminder of reminders) {
        await reminderNotificationService.sendReminderNotification(
          reminder.reminderSetBy,
          reminder.note
        );
      }
    } catch (error) {
      console.error("Reminder scheduler error:", error);
    }
  });
};