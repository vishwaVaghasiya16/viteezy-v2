import mongoose from "mongoose";

const TrainingIntensivelyAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "training_intensively_id": {
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
    collection: "training_intensively_answers"
  }
);

const TrainingIntensivelyAnswers = mongoose.model("TrainingIntensivelyAnswers", TrainingIntensivelyAnswersSchema);
export default TrainingIntensivelyAnswers;
