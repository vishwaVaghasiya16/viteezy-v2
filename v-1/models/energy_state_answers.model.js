import mongoose from "mongoose";

const EnergyStateAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "energy_state_id": {
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
    collection: "energy_state_answers"
  }
);

const EnergyStateAnswers = mongoose.model("EnergyStateAnswers", EnergyStateAnswersSchema);
export default EnergyStateAnswers;
