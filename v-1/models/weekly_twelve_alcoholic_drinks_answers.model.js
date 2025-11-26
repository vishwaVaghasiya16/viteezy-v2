import mongoose from "mongoose";

const WeeklyTwelveAlcoholicDrinksAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "weekly_twelve_alcoholic_drinks_id": {
      type: Number,
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
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "weekly_twelve_alcoholic_drinks_answers"
  }
);

const WeeklyTwelveAlcoholicDrinksAnswers = mongoose.model("WeeklyTwelveAlcoholicDrinksAnswers", WeeklyTwelveAlcoholicDrinksAnswersSchema);
export default WeeklyTwelveAlcoholicDrinksAnswers;
