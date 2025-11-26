import mongoose from "mongoose";

const TroubleFallingAsleepsSchema = new mongoose.Schema(
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
    collection: "trouble_falling_asleeps"
  }
);

const TroubleFallingAsleeps = mongoose.model("TroubleFallingAsleeps", TroubleFallingAsleepsSchema);
export default TroubleFallingAsleeps;
