import mongoose, { Schema, Document } from "mongoose";
import { AuditSchema, SoftDelete } from "../common.model";
import {
  AIConversationStatus,
  MessageRole,
  AI_CONVERSATION_STATUS_VALUES,
  MESSAGE_ROLE_VALUES,
} from "../enums";

export interface IAIConversation extends Document {
  userId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  messages: Array<{
    role: MessageRole;
    content: string;
    timestamp: Date;
  }>;
  context?: {
    topic?: string;
    language?: string;
    preferences?: Record<string, any>;
  };
  status: AIConversationStatus;
  createdAt: Date;
  updatedAt: Date;
}

// 24 days

const AIConversationSchema = new Schema<IAIConversation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    sessionId: {
      type: Schema.Types.ObjectId,
    },
    messages: [
      {
        role: {
          type: String,
          enum: MESSAGE_ROLE_VALUES,
        },
        content: {
          type: String,
          trim: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    context: {
      topic: { type: String, trim: true },
      language: { type: String, default: "en" },
      preferences: { type: Schema.Types.Mixed, default: {} },
    },
    status: {
      type: String,
      enum: AI_CONVERSATION_STATUS_VALUES,
      default: AIConversationStatus.ACTIVE,
    },
    ...SoftDelete,
    ...AuditSchema.obj,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
AIConversationSchema.index({ userId: 1, status: 1 });
AIConversationSchema.index({ sessionId: 1 });
AIConversationSchema.index({ createdAt: -1 });

export const AIConversations = mongoose.model<IAIConversation>(
  "ai_conversations",
  AIConversationSchema
);
