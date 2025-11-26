import mongoose from "mongoose";

const AllergyTypeAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "allergy_type_id": {
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
    collection: "allergy_type_answers"
  }
);

const AllergyTypeAnswers = mongoose.model("AllergyTypeAnswers", AllergyTypeAnswersSchema);
export default AllergyTypeAnswers;
