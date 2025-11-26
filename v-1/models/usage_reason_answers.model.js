import mongoose from "mongoose";

const UsageReasonAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "usage_reason_id": {
      type: Number,
      required: true,
    },
    "creation_timestamp": {
      type: Date,
      required: true,
    },
    "modification_timestamp": {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "usage_reason_answers"
  }
);

const UsageReasonAnswers = mongoose.model("UsageReasonAnswers", UsageReasonAnswersSchema);
export default UsageReasonAnswers;
