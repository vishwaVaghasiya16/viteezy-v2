import mongoose from "mongoose";

const HelpGoalAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "help_goal_id": {
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
    collection: "help_goal_answers"
  }
);

const HelpGoalAnswers = mongoose.model("HelpGoalAnswers", HelpGoalAnswersSchema);
export default HelpGoalAnswers;
