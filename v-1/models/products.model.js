import mongoose from "mongoose";

const ProductsSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "name": {
      type: String,
      required: true,
    },
    "category": {
      type: String,
      required: false,
    },
    "description": {
      type: String,
      required: false,
    },
    "code": {
      type: String,
      required: true,
    },
    "url": {
      type: String,
      required: true,
    },
    "is_vegan": {
      type: Boolean,
      required: true,
    },
    "is_active": {
      type: Boolean,
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
    collection: "products"
  }
);

const Products = mongoose.model("Products", ProductsSchema);
export default Products;
