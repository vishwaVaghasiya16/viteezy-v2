import mongoose from "mongoose";

const DailySixAlcoholicDrinksSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "name": {
      type: String,
      required: true,
    },
    "code": {
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
    "is_active": {
      type: Boolean,
      required: false,
      default: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "daily_six_alcoholic_drinks"
  }
);

const DailySixAlcoholicDrinks = mongoose.model("DailySixAlcoholicDrinks", DailySixAlcoholicDrinksSchema);
export default DailySixAlcoholicDrinks;
