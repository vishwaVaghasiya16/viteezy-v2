import mongoose from "mongoose";

const PresentAtCrowdedPlacesSchema = new mongoose.Schema(
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
    collection: "present_at_crowded_places"
  }
);

const PresentAtCrowdedPlaces = mongoose.model("PresentAtCrowdedPlaces", PresentAtCrowdedPlacesSchema);
export default PresentAtCrowdedPlaces;
