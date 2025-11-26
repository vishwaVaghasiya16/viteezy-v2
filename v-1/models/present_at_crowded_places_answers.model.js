import mongoose from "mongoose";

const PresentAtCrowdedPlacesAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "present_at_crowded_places_id": {
      type: Number,
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
    collection: "present_at_crowded_places_answers"
  }
);

const PresentAtCrowdedPlacesAnswers = mongoose.model("PresentAtCrowdedPlacesAnswers", PresentAtCrowdedPlacesAnswersSchema);
export default PresentAtCrowdedPlacesAnswers;
