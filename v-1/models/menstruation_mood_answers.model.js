import mongoose from "mongoose";

const MenstruationMoodAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "menstruation_mood_id": {
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
    collection: "menstruation_mood_answers"
  }
);

const MenstruationMoodAnswers = mongoose.model("MenstruationMoodAnswers", MenstruationMoodAnswersSchema);
export default MenstruationMoodAnswers;
