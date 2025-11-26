import mongoose from "mongoose";

const UsageGoalAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "usage_goal_id": {
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
    collection: "usage_goal_answers"
  }
);

const UsageGoalAnswers = mongoose.model("UsageGoalAnswers", UsageGoalAnswersSchema);
export default UsageGoalAnswers;
