import mongoose from "mongoose";

const BlendIngredientReasonsSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "code": {
      type: String,
      required: true,
    },
    "description": {
      type: String,
      required: true,
    },
    "creation_timestamp": {
      type: Date,
      required: true,
    },
    "last_modification_timestamp": {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "blend_ingredient_reasons"
  }
);

const BlendIngredientReasons = mongoose.model("BlendIngredientReasons", BlendIngredientReasonsSchema);
export default BlendIngredientReasons;
