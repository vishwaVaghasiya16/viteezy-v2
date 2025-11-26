import mongoose from "mongoose";

const StressLevelAtEndOfDayAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "stress_level_at_end_of_day_id": {
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
    collection: "stress_level_at_end_of_day_answers"
  }
);

const StressLevelAtEndOfDayAnswers = mongoose.model("StressLevelAtEndOfDayAnswers", StressLevelAtEndOfDayAnswersSchema);
export default StressLevelAtEndOfDayAnswers;
