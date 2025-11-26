import mongoose from "mongoose";

const IngredientsSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "name": {
      type: String,
      required: true,
    },
    "type": {
      type: String,
      required: false,
    },
    "description": {
      type: String,
      required: true,
    },
    "code": {
      type: String,
      required: true,
    },
    "url": {
      type: String,
      required: false,
    },
    "strapi_content_id": {
      type: Number,
      required: false,
    },
    "is_a_flavour": {
      type: Boolean,
      required: true,
      default: false,
    },
    "is_vegan": {
      type: String,
      required: false,
      default: "1",
    },
    "is_active": {
      type: Boolean,
      required: false,
      default: true,
    },
    "sku": {
      type: String,
      required: false,
    },
    "creation_timestamp": {
      type: Date,
      required: false,
    },
    "modification_timestamp": {
      type: Date,
      required: false,
    },
    "priority": {
      type: Number,
      required: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "ingredients"
  }
);

const Ingredients = mongoose.model("Ingredients", IngredientsSchema);
export default Ingredients;
