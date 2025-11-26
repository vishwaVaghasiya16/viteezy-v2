import mongoose from "mongoose";

const WeightDesiredAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "weight_desired_gr": {
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
    collection: "weight_desired_answers"
  }
);

const WeightDesiredAnswers = mongoose.model("WeightDesiredAnswers", WeightDesiredAnswersSchema);
export default WeightDesiredAnswers;
