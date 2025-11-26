import mongoose from "mongoose";

const NutritionConsumptionsAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "nutrition_consumption_id": {
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
    collection: "nutrition_consumptions_answers"
  }
);

const NutritionConsumptionsAnswers = mongoose.model("NutritionConsumptionsAnswers", NutritionConsumptionsAnswersSchema);
export default NutritionConsumptionsAnswers;
