import mongoose from "mongoose";

const VegetableConsumptionsSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "name": {
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
    "code": {
      type: String,
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
    collection: "vegetable_consumptions"
  }
);

const VegetableConsumptions = mongoose.model("VegetableConsumptions", VegetableConsumptionsSchema);
export default VegetableConsumptions;
