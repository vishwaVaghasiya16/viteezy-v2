import mongoose from "mongoose";

const WebsiteContentSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "code": {
      type: String,
      required: true,
    },
    "title": {
      type: String,
      required: true,
    },
    "subtitle": {
      type: String,
      required: false,
    },
    "is_active": {
      type: Boolean,
      required: true,
      default: true,
    },
    "creation_timestamp": {
      type: Date,
      required: true,
    },
    "modification_timestamp": {
      type: Date,
      required: true,
    },
    "button_text": {
      type: String,
      required: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "website_content"
  }
);

const WebsiteContent = mongoose.model("WebsiteContent", WebsiteContentSchema);
export default WebsiteContent;
