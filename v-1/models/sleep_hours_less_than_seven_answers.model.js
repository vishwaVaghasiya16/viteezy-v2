import mongoose from "mongoose";

const SleepHoursLessThanSevenAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "sleep_hours_less_than_seven_id": {
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
    collection: "sleep_hours_less_than_seven_answers"
  }
);

const SleepHoursLessThanSevenAnswers = mongoose.model("SleepHoursLessThanSevenAnswers", SleepHoursLessThanSevenAnswersSchema);
export default SleepHoursLessThanSevenAnswers;
