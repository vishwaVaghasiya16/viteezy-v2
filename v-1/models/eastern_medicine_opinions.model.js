import mongoose from "mongoose";

const EasternMedicineOpinionsSchema = new mongoose.Schema(
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
    collection: "eastern_medicine_opinions"
  }
);

const EasternMedicineOpinions = mongoose.model("EasternMedicineOpinions", EasternMedicineOpinionsSchema);
export default EasternMedicineOpinions;
