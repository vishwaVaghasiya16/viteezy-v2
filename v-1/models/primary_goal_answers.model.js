import mongoose from "mongoose";

const PrimaryGoalAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "primary_goal_id": {
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
    collection: "primary_goal_answers"
  }
);

const PrimaryGoalAnswers = mongoose.model("PrimaryGoalAnswers", PrimaryGoalAnswersSchema);
export default PrimaryGoalAnswers;
