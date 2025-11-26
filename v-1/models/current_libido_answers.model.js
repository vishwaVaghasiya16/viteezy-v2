import mongoose from "mongoose";

const CurrentLibidoAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "current_libido_id": {
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
    collection: "current_libido_answers"
  }
);

const CurrentLibidoAnswers = mongoose.model("CurrentLibidoAnswers", CurrentLibidoAnswersSchema);
export default CurrentLibidoAnswers;
