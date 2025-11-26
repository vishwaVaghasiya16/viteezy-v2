import mongoose from "mongoose";

const VegetableConsumptionsAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "vegetable_consumption_id": {
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
    collection: "vegetable_consumptions_answers"
  }
);

const VegetableConsumptionsAnswers = mongoose.model("VegetableConsumptionsAnswers", VegetableConsumptionsAnswersSchema);
export default VegetableConsumptionsAnswers;
