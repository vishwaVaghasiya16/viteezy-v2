import mongoose from "mongoose";

const StressLevelAtEndOfDaysSchema = new mongoose.Schema(
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
    "subtitle": {
      type: String,
      required: false,
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
    collection: "stress_level_at_end_of_days"
  }
);

const StressLevelAtEndOfDays = mongoose.model("StressLevelAtEndOfDays", StressLevelAtEndOfDaysSchema);
export default StressLevelAtEndOfDays;
