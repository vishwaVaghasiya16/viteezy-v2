import mongoose from "mongoose";

const PregnancyStateAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "pregnancy_state_id": {
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
    collection: "pregnancy_state_answers"
  }
);

const PregnancyStateAnswers = mongoose.model("PregnancyStateAnswers", PregnancyStateAnswersSchema);
export default PregnancyStateAnswers;
