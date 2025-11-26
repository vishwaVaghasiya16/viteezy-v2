import mongoose from "mongoose";

const TransitionPeriodComplaintsAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "transition_period_complaints_id": {
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
    collection: "transition_period_complaints_answers"
  }
);

const TransitionPeriodComplaintsAnswers = mongoose.model("TransitionPeriodComplaintsAnswers", TransitionPeriodComplaintsAnswersSchema);
export default TransitionPeriodComplaintsAnswers;
