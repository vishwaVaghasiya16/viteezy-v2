import mongoose from "mongoose";

const DigestionOccurrenceAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "digestion_occurrence_id": {
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
    collection: "digestion_occurrence_answers"
  }
);

const DigestionOccurrenceAnswers = mongoose.model("DigestionOccurrenceAnswers", DigestionOccurrenceAnswersSchema);
export default DigestionOccurrenceAnswers;
