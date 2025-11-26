import mongoose from "mongoose";

const EasternMedicineOpinionAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "eastern_medicine_opinion_id": {
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
    collection: "eastern_medicine_opinion_answers"
  }
);

const EasternMedicineOpinionAnswers = mongoose.model("EasternMedicineOpinionAnswers", EasternMedicineOpinionAnswersSchema);
export default EasternMedicineOpinionAnswers;
