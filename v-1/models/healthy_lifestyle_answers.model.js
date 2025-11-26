import mongoose from "mongoose";

const HealthyLifestyleAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "healthy_lifestyle_id": {
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
    collection: "healthy_lifestyle_answers"
  }
);

const HealthyLifestyleAnswers = mongoose.model("HealthyLifestyleAnswers", HealthyLifestyleAnswersSchema);
export default HealthyLifestyleAnswers;
