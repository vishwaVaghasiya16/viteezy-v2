import mongoose from "mongoose";

const LoggingSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "customer_id": {
      type: Number,
      required: true,
    },
    "event": {
      type: String,
      required: true,
    },
    "info": {
      type: String,
      required: true,
    },
    "creation_timestamp": {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "logging"
  }
);

const Logging = mongoose.model("Logging", LoggingSchema);
export default Logging;
