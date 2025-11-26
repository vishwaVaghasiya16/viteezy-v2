import mongoose from "mongoose";

const AverageSleepingHoursAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "average_sleeping_hours_id": {
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
    collection: "average_sleeping_hours_answers"
  }
);

const AverageSleepingHoursAnswers = mongoose.model("AverageSleepingHoursAnswers", AverageSleepingHoursAnswersSchema);
export default AverageSleepingHoursAnswers;
