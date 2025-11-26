import mongoose from "mongoose";

const ThirtyMinutesOfSunsSchema = new mongoose.Schema(
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
    collection: "thirty_minutes_of_suns"
  }
);

const ThirtyMinutesOfSuns = mongoose.model("ThirtyMinutesOfSuns", ThirtyMinutesOfSunsSchema);
export default ThirtyMinutesOfSuns;
