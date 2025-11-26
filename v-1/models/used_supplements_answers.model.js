import mongoose from "mongoose";

const UsedSupplementsAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "used_supplement_id": {
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
    collection: "used_supplements_answers"
  }
);

const UsedSupplementsAnswers = mongoose.model("UsedSupplementsAnswers", UsedSupplementsAnswersSchema);
export default UsedSupplementsAnswers;
