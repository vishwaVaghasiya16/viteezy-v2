import mongoose from "mongoose";

const TypeOfTrainingAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "type_of_training_id": {
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
    collection: "type_of_training_answers"
  }
);

const TypeOfTrainingAnswers = mongoose.model("TypeOfTrainingAnswers", TypeOfTrainingAnswersSchema);
export default TypeOfTrainingAnswers;
