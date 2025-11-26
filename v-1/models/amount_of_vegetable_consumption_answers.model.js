import mongoose from "mongoose";

const AmountOfVegetableConsumptionAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "amount_of_vegetable_consumption_id": {
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
    collection: "amount_of_vegetable_consumption_answers"
  }
);

const AmountOfVegetableConsumptionAnswers = mongoose.model("AmountOfVegetableConsumptionAnswers", AmountOfVegetableConsumptionAnswersSchema);
export default AmountOfVegetableConsumptionAnswers;
