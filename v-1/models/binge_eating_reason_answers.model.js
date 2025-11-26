import mongoose from "mongoose";

const BingeEatingReasonAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "binge_eating_reason_id": {
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
    collection: "binge_eating_reason_answers"
  }
);

const BingeEatingReasonAnswers = mongoose.model("BingeEatingReasonAnswers", BingeEatingReasonAnswersSchema);
export default BingeEatingReasonAnswers;
