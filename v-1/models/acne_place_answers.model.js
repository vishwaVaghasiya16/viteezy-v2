import mongoose from "mongoose";

const AcnePlaceAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "acne_place_id": {
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
    collection: "acne_place_answers"
  }
);

const AcnePlaceAnswers = mongoose.model("AcnePlaceAnswers", AcnePlaceAnswersSchema);
export default AcnePlaceAnswers;
