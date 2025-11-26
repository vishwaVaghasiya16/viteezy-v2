import mongoose from "mongoose";

const MinutesOfSunAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "minutes_of_sun_id": {
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
    collection: "minutes_of_sun_answers"
  }
);

const MinutesOfSunAnswers = mongoose.model("MinutesOfSunAnswers", MinutesOfSunAnswersSchema);
export default MinutesOfSunAnswers;
