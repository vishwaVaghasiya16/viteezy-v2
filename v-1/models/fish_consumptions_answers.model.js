import mongoose from "mongoose";

const FishConsumptionsAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "fish_consumption_id": {
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
    collection: "fish_consumptions_answers"
  }
);

const FishConsumptionsAnswers = mongoose.model("FishConsumptionsAnswers", FishConsumptionsAnswersSchema);
export default FishConsumptionsAnswers;
