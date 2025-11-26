import mongoose from "mongoose";

const ReferralsSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "from_id": {
      type: Number,
      required: true,
    },
    "to_id": {
      type: Number,
      required: true,
    },
    "amount": {
      type: Number,
      required: true,
    },
    "status": {
      type: String,
      required: true,
    },
    "creation_date": {
      type: Date,
      required: true,
    },
    "last_modified": {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "referrals"
  }
);

const Referrals = mongoose.model("Referrals", ReferralsSchema);
export default Referrals;
