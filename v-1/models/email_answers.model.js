import mongoose from "mongoose";

const EmailAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "email": {
      type: String,
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
    "opt_in": {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "email_answers"
  }
);

const EmailAnswers = mongoose.model("EmailAnswers", EmailAnswersSchema);
export default EmailAnswers;
