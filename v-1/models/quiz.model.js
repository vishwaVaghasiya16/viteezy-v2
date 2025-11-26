import mongoose from "mongoose";

const QuizSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "external_reference": {
      type: String,
      required: true,
    },
    "creation_date": {
      type: Date,
      required: true,
    },
    "last_modified": {
      type: Date,
      required: true,
    },
    "customer_id": {
      type: Number,
      required: false,
    },
    "utm_content": {
      type: String,
      required: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "quiz"
  }
);

const Quiz = mongoose.model("Quiz", QuizSchema);
export default Quiz;
