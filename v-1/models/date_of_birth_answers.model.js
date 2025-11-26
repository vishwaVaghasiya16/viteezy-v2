import mongoose from "mongoose";

const DateOfBirthAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "date": {
      type: Date,
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
    collection: "date_of_birth_answers"
  }
);

const DateOfBirthAnswers = mongoose.model("DateOfBirthAnswers", DateOfBirthAnswersSchema);
export default DateOfBirthAnswers;
