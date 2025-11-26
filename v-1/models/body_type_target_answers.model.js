import mongoose from "mongoose";

const BodyTypeTargetAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "body_type_target_id": {
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
    collection: "body_type_target_answers"
  }
);

const BodyTypeTargetAnswers = mongoose.model("BodyTypeTargetAnswers", BodyTypeTargetAnswersSchema);
export default BodyTypeTargetAnswers;
