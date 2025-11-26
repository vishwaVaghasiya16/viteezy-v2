import mongoose from "mongoose";

const TroubleFallingAsleepAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "trouble_falling_asleep_id": {
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
    collection: "trouble_falling_asleep_answers"
  }
);

const TroubleFallingAsleepAnswers = mongoose.model("TroubleFallingAsleepAnswers", TroubleFallingAsleepAnswersSchema);
export default TroubleFallingAsleepAnswers;
