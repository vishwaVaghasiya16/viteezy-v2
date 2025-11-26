import mongoose from "mongoose";

const DigestionAmountAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "digestion_amount_id": {
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
    collection: "digestion_amount_answers"
  }
);

const DigestionAmountAnswers = mongoose.model("DigestionAmountAnswers", DigestionAmountAnswersSchema);
export default DigestionAmountAnswers;
