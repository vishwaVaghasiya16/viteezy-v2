import mongoose from "mongoose";

const MentalFitnessAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "mental_fitness_id": {
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
    collection: "mental_fitness_answers"
  }
);

const MentalFitnessAnswers = mongoose.model("MentalFitnessAnswers", MentalFitnessAnswersSchema);
export default MentalFitnessAnswers;
