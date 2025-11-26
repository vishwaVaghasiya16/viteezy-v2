import mongoose from "mongoose";

const DietIntoleranceAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "diet_intolerance_id": {
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
    collection: "diet_intolerance_answers"
  }
);

const DietIntoleranceAnswers = mongoose.model("DietIntoleranceAnswers", DietIntoleranceAnswersSchema);
export default DietIntoleranceAnswers;
