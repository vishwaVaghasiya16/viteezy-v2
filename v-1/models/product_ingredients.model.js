import mongoose from "mongoose";

const ProductIngredientsSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "product_id": {
      type: Number,
      required: true,
    },
    "ingredient_id": {
      type: Number,
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
    collection: "product_ingredients"
  }
);

const ProductIngredients = mongoose.model("ProductIngredients", ProductIngredientsSchema);
export default ProductIngredients;
