import mongoose from "mongoose";

const NewProductAvailableAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "new_product_available_id": {
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
    collection: "new_product_available_answers"
  }
);

const NewProductAvailableAnswers = mongoose.model("NewProductAvailableAnswers", NewProductAvailableAnswersSchema);
export default NewProductAvailableAnswers;
