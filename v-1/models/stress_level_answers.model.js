import mongoose from "mongoose";

const StressLevelAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "stress_level_id": {
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
    collection: "stress_level_answers"
  }
);

const StressLevelAnswers = mongoose.model("StressLevelAnswers", StressLevelAnswersSchema);
export default StressLevelAnswers;
