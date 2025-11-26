import mongoose from "mongoose";

const MentalFitnessSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "name": {
      type: String,
      required: true,
    },
    "code": {
      type: String,
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
    collection: "mental_fitness"
  }
);

const MentalFitness = mongoose.model("MentalFitness", MentalFitnessSchema);
export default MentalFitness;
