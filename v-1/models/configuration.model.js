import mongoose from "mongoose";

const ConfigurationSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "name": {
      type: String,
      required: true,
    },
    "type": {
      type: String,
      required: false,
    },
    "value": {
      type: String,
      required: true,
    },
    "expiration_timestamp": {
      type: Date,
      required: false,
    },
    "modification_timestamp": {
      type: Date,
      required: true,
    },
    "creation_timestamp": {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "configuration"
  }
);

const Configuration = mongoose.model("Configuration", ConfigurationSchema);
export default Configuration;
