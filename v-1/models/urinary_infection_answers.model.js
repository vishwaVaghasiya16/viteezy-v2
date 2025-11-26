import mongoose from "mongoose";

const UrinaryInfectionAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "urinary_infection_id": {
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
    collection: "urinary_infection_answers"
  }
);

const UrinaryInfectionAnswers = mongoose.model("UrinaryInfectionAnswers", UrinaryInfectionAnswersSchema);
export default UrinaryInfectionAnswers;
