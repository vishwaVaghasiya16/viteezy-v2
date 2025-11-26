import mongoose from "mongoose";

const MenstruationIntervalAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "menstruation_interval_id": {
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
    collection: "menstruation_interval_answers"
  }
);

const MenstruationIntervalAnswers = mongoose.model("MenstruationIntervalAnswers", MenstruationIntervalAnswersSchema);
export default MenstruationIntervalAnswers;
