import mongoose from "mongoose";

const FlywaySchemaHistorySchema = new mongoose.Schema(
  {
    "installed_rank": {
      type: Number,
      required: true,
    },
    "version": {
      type: String,
      required: false,
    },
    "description": {
      type: String,
      required: true,
    },
    "type": {
      type: String,
      required: true,
    },
    "script": {
      type: String,
      required: true,
    },
    "checksum": {
      type: Number,
      required: false,
    },
    "installed_by": {
      type: String,
      required: true,
    },
    "installed_on": {
      type: Date,
      required: true,
    },
    "execution_time": {
      type: Number,
      required: true,
    },
    "success": {
      type: Boolean,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "flyway_schema_history"
  }
);

const FlywaySchemaHistory = mongoose.model("FlywaySchemaHistory", FlywaySchemaHistorySchema);
export default FlywaySchemaHistory;
