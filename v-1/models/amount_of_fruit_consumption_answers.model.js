import mongoose from "mongoose";

const AmountOfFruitConsumptionAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "amount_of_fruit_consumption_id": {
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
    collection: "amount_of_fruit_consumption_answers"
  }
);

const AmountOfFruitConsumptionAnswers = mongoose.model("AmountOfFruitConsumptionAnswers", AmountOfFruitConsumptionAnswersSchema);
export default AmountOfFruitConsumptionAnswers;
