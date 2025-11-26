import mongoose from "mongoose";

const AttentionStateAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "attention_state_id": {
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
    collection: "attention_state_answers"
  }
);

const AttentionStateAnswers = mongoose.model("AttentionStateAnswers", AttentionStateAnswersSchema);
export default AttentionStateAnswers;
