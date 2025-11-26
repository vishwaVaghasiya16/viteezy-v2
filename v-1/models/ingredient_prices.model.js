import mongoose from "mongoose";

const IngredientPricesSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "ingredient_id": {
      type: Number,
      required: true,
    },
    "amount": {
      type: Number,
      required: true,
    },
    "international_system_unit": {
      type: String,
      required: true,
    },
    "price": {
      type: Number,
      required: true,
    },
    "currency": {
      type: String,
      required: true,
      default: "EUR",
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "ingredient_prices"
  }
);

const IngredientPrices = mongoose.model("IngredientPrices", IngredientPricesSchema);
export default IngredientPrices;
