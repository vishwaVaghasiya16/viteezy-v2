import mongoose from "mongoose";

const VitaminIntakeAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "vitamin_intake_id": {
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
    collection: "vitamin_intake_answers"
  }
);

const VitaminIntakeAnswers = mongoose.model("VitaminIntakeAnswers", VitaminIntakeAnswersSchema);
export default VitaminIntakeAnswers;
