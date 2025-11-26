import mongoose from "mongoose";

const SleepHoursLessThanSevensSchema = new mongoose.Schema(
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
    collection: "sleep_hours_less_than_sevens"
  }
);

const SleepHoursLessThanSevens = mongoose.model("SleepHoursLessThanSevens", SleepHoursLessThanSevensSchema);
export default SleepHoursLessThanSevens;
