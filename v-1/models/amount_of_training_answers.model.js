import mongoose from "mongoose";

const AmountOfTrainingAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "amount_of_training_id": {
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
    collection: "amount_of_training_answers"
  }
);

const AmountOfTrainingAnswers = mongoose.model("AmountOfTrainingAnswers", AmountOfTrainingAnswersSchema);
export default AmountOfTrainingAnswers;
