import mongoose from "mongoose";

const NailImprovementAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "nail_improvement_id": {
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
    collection: "nail_improvement_answers"
  }
);

const NailImprovementAnswers = mongoose.model("NailImprovementAnswers", NailImprovementAnswersSchema);
export default NailImprovementAnswers;
