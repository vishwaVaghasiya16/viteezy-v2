import mongoose from "mongoose";

const IncentivesSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "customer_id": {
      type: Number,
      required: true,
    },
    "amount": {
      type: Number,
      required: false,
    },
    "incentive_type": {
      type: String,
      required: true,
    },
    "status": {
      type: String,
      required: true,
    },
    "creation_date": {
      type: Date,
      required: false,
    },
    "last_modified": {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "incentives"
  }
);

const Incentives = mongoose.model("Incentives", IncentivesSchema);
export default Incentives;
