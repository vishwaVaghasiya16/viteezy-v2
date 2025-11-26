import mongoose from "mongoose";

const AttentionFocusAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "attention_focus_id": {
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
    collection: "attention_focus_answers"
  }
);

const AttentionFocusAnswers = mongoose.model("AttentionFocusAnswers", AttentionFocusAnswersSchema);
export default AttentionFocusAnswers;
