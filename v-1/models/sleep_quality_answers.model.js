import mongoose from "mongoose";

const SleepQualityAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "sleep_quality_id": {
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
    collection: "sleep_quality_answers"
  }
);

const SleepQualityAnswers = mongoose.model("SleepQualityAnswers", SleepQualityAnswersSchema);
export default SleepQualityAnswers;
