import mongoose from "mongoose";

const VitaminOpinionAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "vitamin_opinion_id": {
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
    collection: "vitamin_opinion_answers"
  }
);

const VitaminOpinionAnswers = mongoose.model("VitaminOpinionAnswers", VitaminOpinionAnswersSchema);
export default VitaminOpinionAnswers;
