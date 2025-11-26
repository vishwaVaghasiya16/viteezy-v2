import mongoose from "mongoose";

const AmountOfProteinConsumptionAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "amount_of_protein_consumption_id": {
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
    collection: "amount_of_protein_consumption_answers"
  }
);

const AmountOfProteinConsumptionAnswers = mongoose.model("AmountOfProteinConsumptionAnswers", AmountOfProteinConsumptionAnswersSchema);
export default AmountOfProteinConsumptionAnswers;
