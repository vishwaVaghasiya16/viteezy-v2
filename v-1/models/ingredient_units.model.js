import mongoose from "mongoose";

const IngredientUnitsSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "ingredient_id": {
      type: Number,
      required: true,
    },
    "pharmacist_code": {
      type: Number,
      required: true,
    },
    "pharmacist_size": {
      type: String,
      required: true,
    },
    "pharmacist_unit": {
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
    collection: "ingredient_units"
  }
);

const IngredientUnits = mongoose.model("IngredientUnits", IngredientUnitsSchema);
export default IngredientUnits;
