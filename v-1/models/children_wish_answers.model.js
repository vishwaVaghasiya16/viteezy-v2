import mongoose from "mongoose";

const ChildrenWishAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "children_wish_id": {
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
    collection: "children_wish_answers"
  }
);

const ChildrenWishAnswers = mongoose.model("ChildrenWishAnswers", ChildrenWishAnswersSchema);
export default ChildrenWishAnswers;
