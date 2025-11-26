import mongoose from "mongoose";

const LackOfConcentrationAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "lack_of_concentration_id": {
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
    collection: "lack_of_concentration_answers"
  }
);

const LackOfConcentrationAnswers = mongoose.model("LackOfConcentrationAnswers", LackOfConcentrationAnswersSchema);
export default LackOfConcentrationAnswers;
