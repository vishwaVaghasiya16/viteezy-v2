import mongoose from "mongoose";

const BirthHealthAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "birth_health_id": {
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
    collection: "birth_health_answers"
  }
);

const BirthHealthAnswers = mongoose.model("BirthHealthAnswers", BirthHealthAnswersSchema);
export default BirthHealthAnswers;
