import mongoose from "mongoose";

const LoseWeightChallengeAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "lose_weight_challenge_id": {
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
    collection: "lose_weight_challenge_answers"
  }
);

const LoseWeightChallengeAnswers = mongoose.model("LoseWeightChallengeAnswers", LoseWeightChallengeAnswersSchema);
export default LoseWeightChallengeAnswers;
