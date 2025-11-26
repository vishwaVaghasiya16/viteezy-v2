import mongoose from "mongoose";

const BlendIngredientsRelationsHistorySchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "ingredient_id": {
      type: Number,
      required: true,
    },
    "blend_id": {
      type: Number,
      required: true,
    },
    "amount": {
      type: Number,
      required: true,
    },
    "is_unit": {
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
    "price": {
      type: Number,
      required: true,
      default: 0.0,
    },
    "currency": {
      type: String,
      required: true,
      default: "EUR",
    },
    "explanation": {
      type: String,
      required: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "blend_ingredients_relations_history"
  }
);

const BlendIngredientsRelationsHistory = mongoose.model("BlendIngredientsRelationsHistory", BlendIngredientsRelationsHistorySchema);
export default BlendIngredientsRelationsHistory;
