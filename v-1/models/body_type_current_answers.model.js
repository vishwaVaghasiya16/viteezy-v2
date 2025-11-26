import mongoose from "mongoose";

const BodyTypeCurrentAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "body_type_current_id": {
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
    collection: "body_type_current_answers"
  }
);

const BodyTypeCurrentAnswers = mongoose.model("BodyTypeCurrentAnswers", BodyTypeCurrentAnswersSchema);
export default BodyTypeCurrentAnswers;
