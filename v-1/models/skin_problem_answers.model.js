import mongoose from "mongoose";

const SkinProblemAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "skin_problem_id": {
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
    collection: "skin_problem_answers"
  }
);

const SkinProblemAnswers = mongoose.model("SkinProblemAnswers", SkinProblemAnswersSchema);
export default SkinProblemAnswers;
