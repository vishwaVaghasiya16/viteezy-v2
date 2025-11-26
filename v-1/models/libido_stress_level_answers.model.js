import mongoose from "mongoose";

const LibidoStressLevelAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "libido_stress_level_id": {
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
    collection: "libido_stress_level_answers"
  }
);

const LibidoStressLevelAnswers = mongoose.model("LibidoStressLevelAnswers", LibidoStressLevelAnswersSchema);
export default LibidoStressLevelAnswers;
