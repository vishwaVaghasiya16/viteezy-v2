import mongoose, { Schema, Document } from "mongoose";
import {
  NotificationCategory,
  NotificationType,
  NOTIFICATION_CATEGORY_VALUES,
  NOTIFICATION_TYPE_VALUES,
} from "../enums";
import { SoftDelete } from "../common.model";

/**
 * Get valid query keys for a given app route
 */
function getValidQueryKeysForRoute(route: string): string[] {
  const routeQueryMap: Record<string, string[]> = {
    "/product-detail": ["productId"],
    "/orderDetail": ["orderId"],
    "/subscription": ["subscriptionId"],
    "/membership": ["membershipId"],
    "/support": ["ticketId"],
    "/ai-chat": ["quizSessionId", "expertId"],
  };
  return routeQueryMap[route] || [];
}

/**
 * Notification Interface
 */
export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  category: NotificationCategory;
  type: NotificationType; // Legacy: NORMAL/REDIRECTION (kept for backward compatibility)
  title: string;
  message: string;
  data?: Record<string, any>; // Additional data payload
  redirectUrl?: string; // URL to redirect when notification is clicked (for web)
  // Mobile app navigation fields
  appRoute?: string; // Mobile app route (e.g., "/dashboard", "/orderDetail", "/product-detail")
  query?: Record<string, string>; // Query parameters for mobile app navigation (e.g., { orderId: "123" })
  isRead: boolean;
  readAt?: Date;
  pushSent: boolean; // Whether push notification was sent successfully
  pushSentAt?: Date; // When push notification was sent
  pushError?: string; // Error message if push notification failed
  // Soft delete fields
  isDeleted: boolean;
  deletedAt?: Date;
  // Audit fields
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Notification Schema
 */
const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    category: {
      type: String,
      enum: NOTIFICATION_CATEGORY_VALUES,
      required: [true, "Notification category is required"],
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPE_VALUES,
      required: [true, "Notification type is required"],
      default: NotificationType.NORMAL,
    },
    title: {
      type: String,
      required: [true, "Notification title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    message: {
      type: String,
      required: [true, "Notification message is required"],
      trim: true,
      maxlength: [1000, "Message cannot exceed 1000 characters"],
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    redirectUrl: {
      type: String,
      trim: true,
      validate: {
        validator: function (this: INotification, value: string) {
          // redirectUrl is required if type is REDIRECTION (for web)
          if (this.type === NotificationType.REDIRECTION) {
            return !!value && value.trim().length > 0;
          }
          return true;
        },
        message: "Redirect URL is required for redirection type notifications",
      },
    },
    // Mobile app navigation fields
    appRoute: {
      type: String,
      trim: true,
      enum: [
        "/dashboard",
        "/product-detail",
        "/orderDetail",
        "/subscription",
        "/membership",
        "/support",
        "/ai-chat",
      ],
    },
    query: {
      type: Schema.Types.Mixed,
      default: {},
      validate: {
        validator: function (this: INotification, value: Record<string, any>) {
          // If appRoute is set and not "/dashboard", query must have required keys
          if (this.appRoute && this.appRoute !== "/dashboard") {
            if (!value || Object.keys(value).length === 0) {
              return false;
            }
            // Validate query keys based on route
            const validKeys = getValidQueryKeysForRoute(this.appRoute);
            const queryKeys = Object.keys(value || {});
            return queryKeys.every((key) => validKeys.includes(key));
          }
          // For "/dashboard" or no appRoute, query can be empty object
          return true;
        },
        message: "Query parameters are required for non-dashboard routes",
      },
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    pushSent: {
      type: Boolean,
      default: false,
      index: true,
    },
    pushSentAt: {
      type: Date,
    },
    pushError: {
      type: String,
      trim: true,
    },
    ...SoftDelete,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, category: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isDeleted: 1 });
notificationSchema.index({ pushSent: 1, createdAt: -1 }); // For retry failed pushes

// Virtual for unread count (can be used in aggregation)
notificationSchema.virtual("unreadCount", {
  ref: "Notification",
  localField: "userId",
  foreignField: "userId",
  count: true,
  match: { isRead: false, isDeleted: false },
});

export const Notification = mongoose.model<INotification>(
  "Notification",
  notificationSchema
);

