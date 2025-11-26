import mongoose from "mongoose";

const IronPrescribedAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "iron_prescribed_id": {
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
    collection: "iron_prescribed_answers"
  }
);

const IronPrescribedAnswers = mongoose.model("IronPrescribedAnswers", IronPrescribedAnswersSchema);
export default IronPrescribedAnswers;
