import mongoose from "mongoose";

const FruitConsumptionsAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "fruit_consumption_id": {
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
    collection: "fruit_consumptions_answers"
  }
);

const FruitConsumptionsAnswers = mongoose.model("FruitConsumptionsAnswers", FruitConsumptionsAnswersSchema);
export default FruitConsumptionsAnswers;
