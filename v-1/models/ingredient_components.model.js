import mongoose from "mongoose";

const IngredientComponentsSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "ingredient_id": {
      type: Number,
      required: true,
    },
    "name": {
      type: String,
      required: true,
    },
    "amount": {
      type: String,
      required: true,
    },
    "percentage": {
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
    collection: "ingredient_components"
  }
);

const IngredientComponents = mongoose.model("IngredientComponents", IngredientComponentsSchema);
export default IngredientComponents;
