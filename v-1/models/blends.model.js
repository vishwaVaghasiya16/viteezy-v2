import mongoose from "mongoose";

const BlendsSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "status": {
      type: String,
      required: true,
      default: "CREATED",
    },
    "creation_timestamp": {
      type: Date,
      required: true,
    },
    "modification_timestamp": {
      type: Date,
      required: true,
    },
    "external_reference": {
      type: String,
      required: true,
    },
    "customer_id": {
      type: Number,
      required: false,
    },
    "quiz_id": {
      type: Number,
      required: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "blends"
  }
);

const Blends = mongoose.model("Blends", BlendsSchema);
export default Blends;
