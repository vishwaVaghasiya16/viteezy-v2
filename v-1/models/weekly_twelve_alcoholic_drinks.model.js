import mongoose from "mongoose";

const WeeklyTwelveAlcoholicDrinksSchema = new mongoose.Schema(
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
    collection: "weekly_twelve_alcoholic_drinks"
  }
);

const WeeklyTwelveAlcoholicDrinks = mongoose.model("WeeklyTwelveAlcoholicDrinks", WeeklyTwelveAlcoholicDrinksSchema);
export default WeeklyTwelveAlcoholicDrinks;
