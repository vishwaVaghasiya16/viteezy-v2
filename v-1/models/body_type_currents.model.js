import mongoose from "mongoose";

const BodyTypeCurrentsSchema = new mongoose.Schema(
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
    "is_active": {
      type: Boolean,
      required: false,
      default: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "body_type_currents"
  }
);

const BodyTypeCurrents = mongoose.model("BodyTypeCurrents", BodyTypeCurrentsSchema);
export default BodyTypeCurrents;
