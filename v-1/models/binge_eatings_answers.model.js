import mongoose from "mongoose";

const BingeEatingsAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "binge_eating_id": {
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
    collection: "binge_eatings_answers"
  }
);

const BingeEatingsAnswers = mongoose.model("BingeEatingsAnswers", BingeEatingsAnswersSchema);
export default BingeEatingsAnswers;
