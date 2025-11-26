import mongoose from "mongoose";

const StressLevelConditionAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "stress_level_condition_id": {
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
    collection: "stress_level_condition_answers"
  }
);

const StressLevelConditionAnswers = mongoose.model("StressLevelConditionAnswers", StressLevelConditionAnswersSchema);
export default StressLevelConditionAnswers;
