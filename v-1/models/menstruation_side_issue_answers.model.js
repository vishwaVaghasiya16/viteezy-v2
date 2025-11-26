import mongoose from "mongoose";

const MenstruationSideIssueAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "menstruation_side_issue_id": {
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
    collection: "menstruation_side_issue_answers"
  }
);

const MenstruationSideIssueAnswers = mongoose.model("MenstruationSideIssueAnswers", MenstruationSideIssueAnswersSchema);
export default MenstruationSideIssueAnswers;
