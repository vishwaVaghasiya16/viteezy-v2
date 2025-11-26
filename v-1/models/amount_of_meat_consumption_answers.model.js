import mongoose from "mongoose";

const AmountOfMeatConsumptionAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "amount_of_meat_consumption_id": {
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
    collection: "amount_of_meat_consumption_answers"
  }
);

const AmountOfMeatConsumptionAnswers = mongoose.model("AmountOfMeatConsumptionAnswers", AmountOfMeatConsumptionAnswersSchema);
export default AmountOfMeatConsumptionAnswers;
