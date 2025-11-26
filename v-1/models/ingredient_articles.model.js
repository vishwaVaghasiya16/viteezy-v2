import mongoose from "mongoose";

const IngredientArticlesSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "ingredient_id": {
      type: Number,
      required: true,
    },
    "author": {
      type: String,
      required: false,
    },
    "title": {
      type: String,
      required: false,
    },
    "url": {
      type: String,
      required: false,
    },
    "source": {
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
    collection: "ingredient_articles"
  }
);

const IngredientArticles = mongoose.model("IngredientArticles", IngredientArticlesSchema);
export default IngredientArticles;
