import mongoose from "mongoose";

const TransitionPeriodComplaintsSchema = new mongoose.Schema(
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
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "transition_period_complaints"
  }
);

const TransitionPeriodComplaints = mongoose.model("TransitionPeriodComplaints", TransitionPeriodComplaintsSchema);
export default TransitionPeriodComplaints;
