import mongoose from "mongoose";

const HoursOfSleepAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "hours_of_sleep_id": {
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
    collection: "hours_of_sleep_answers"
  }
);

const HoursOfSleepAnswers = mongoose.model("HoursOfSleepAnswers", HoursOfSleepAnswersSchema);
export default HoursOfSleepAnswers;
