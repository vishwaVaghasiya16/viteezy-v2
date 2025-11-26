import mongoose from "mongoose";

const TiredWhenWakeUpAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "tired_when_wake_up_id": {
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
    collection: "tired_when_wake_up_answers"
  }
);

const TiredWhenWakeUpAnswers = mongoose.model("TiredWhenWakeUpAnswers", TiredWhenWakeUpAnswersSchema);
export default TiredWhenWakeUpAnswers;
