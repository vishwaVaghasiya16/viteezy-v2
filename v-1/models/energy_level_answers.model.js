import mongoose from "mongoose";

const EnergyLevelAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "energy_level_id": {
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
    collection: "energy_level_answers"
  }
);

const EnergyLevelAnswers = mongoose.model("EnergyLevelAnswers", EnergyLevelAnswersSchema);
export default EnergyLevelAnswers;
