import mongoose from "mongoose";

const AmountOfVegetableConsumptionsSchema = new mongoose.Schema(
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
    collection: "amount_of_vegetable_consumptions"
  }
);

const AmountOfVegetableConsumptions = mongoose.model("AmountOfVegetableConsumptions", AmountOfVegetableConsumptionsSchema);
export default AmountOfVegetableConsumptions;
