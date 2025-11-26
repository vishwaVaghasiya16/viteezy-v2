import mongoose from "mongoose";

const ReviewsSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "source": {
      type: String,
      required: true,
    },
    "total": {
      type: Number,
      required: true,
    },
    "min_score": {
      type: Number,
      required: true,
    },
    "max_score": {
      type: Number,
      required: true,
    },
    "score": {
      type: Number,
      required: true,
    },
    "score_label": {
      type: String,
      required: true,
    },
    "creation_timestamp": {
      type: Date,
      required: false,
    },
    "modification_timestamp": {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "reviews"
  }
);

const Reviews = mongoose.model("Reviews", ReviewsSchema);
export default Reviews;
