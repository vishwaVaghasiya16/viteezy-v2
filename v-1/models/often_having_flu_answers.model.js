import mongoose from "mongoose";

const OftenHavingFluAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "often_having_flu_id": {
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
    collection: "often_having_flu_answers"
  }
);

const OftenHavingFluAnswers = mongoose.model("OftenHavingFluAnswers", OftenHavingFluAnswersSchema);
export default OftenHavingFluAnswers;
