import mongoose from "mongoose";

const IngredientContentSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "ingredient_id": {
      type: Number,
      required: true,
    },
    "description": {
      type: String,
      required: false,
    },
    "bullets": {
      type: String,
      required: false,
    },
    "title_1": {
      type: String,
      required: false,
    },
    "text_1": {
      type: String,
      required: false,
    },
    "title_2": {
      type: String,
      required: false,
    },
    "text_2": {
      type: String,
      required: false,
    },
    "title_3": {
      type: String,
      required: false,
    },
    "text_3": {
      type: String,
      required: false,
    },
    "notice": {
      type: String,
      required: false,
    },
    "excipients": {
      type: String,
      required: false,
    },
    "claim": {
      type: String,
      required: false,
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
    collection: "ingredient_content"
  }
);

const IngredientContent = mongoose.model("IngredientContent", IngredientContentSchema);
export default IngredientContent;
