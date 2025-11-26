import mongoose from "mongoose";

const AmountOfDairyConsumptionsSchema = new mongoose.Schema(
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
    collection: "amount_of_dairy_consumptions"
  }
);

const AmountOfDairyConsumptions = mongoose.model("AmountOfDairyConsumptions", AmountOfDairyConsumptionsSchema);
export default AmountOfDairyConsumptions;
