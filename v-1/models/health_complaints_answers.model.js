import mongoose from "mongoose";

const HealthComplaintsAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "health_complaints_id": {
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
    collection: "health_complaints_answers"
  }
);

const HealthComplaintsAnswers = mongoose.model("HealthComplaintsAnswers", HealthComplaintsAnswersSchema);
export default HealthComplaintsAnswers;
