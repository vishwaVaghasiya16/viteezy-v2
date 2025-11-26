import mongoose from "mongoose";

const MenstruationSideIssuesSchema = new mongoose.Schema(
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
    collection: "menstruation_side_issues"
  }
);

const MenstruationSideIssues = mongoose.model("MenstruationSideIssues", MenstruationSideIssuesSchema);
export default MenstruationSideIssues;
