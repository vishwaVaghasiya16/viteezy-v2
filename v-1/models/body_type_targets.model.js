import mongoose from "mongoose";

const BodyTypeTargetsSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "name": {
      type: String,
      required: true,
    },
    "code": {
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
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "body_type_targets"
  }
);

const BodyTypeTargets = mongoose.model("BodyTypeTargets", BodyTypeTargetsSchema);
export default BodyTypeTargets;
