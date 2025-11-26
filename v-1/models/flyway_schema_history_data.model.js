import mongoose from "mongoose";

const FlywaySchemaHistoryDataSchema = new mongoose.Schema(
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
    collection: "flyway_schema_history_data"
  }
);

const FlywaySchemaHistoryData = mongoose.model("FlywaySchemaHistoryData", FlywaySchemaHistoryDataSchema);
export default FlywaySchemaHistoryData;
