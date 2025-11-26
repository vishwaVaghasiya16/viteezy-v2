import mongoose from "mongoose";

const ThirtyMinutesOfSunAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "thirty_minutes_of_sun_id": {
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
    collection: "thirty_minutes_of_sun_answers"
  }
);

const ThirtyMinutesOfSunAnswers = mongoose.model("ThirtyMinutesOfSunAnswers", ThirtyMinutesOfSunAnswersSchema);
export default ThirtyMinutesOfSunAnswers;
