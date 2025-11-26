import mongoose from "mongoose";

const NotesSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "from_id": {
      type: Number,
      required: true,
    },
    "customer_id": {
      type: Number,
      required: true,
    },
    "message": {
      type: String,
      required: true,
    },
    "creation_timestamp": {
      type: Date,
      required: false,
    },
    "modification_timestamp": {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "notes"
  }
);

const Notes = mongoose.model("Notes", NotesSchema);
export default Notes;
