import mongoose from "mongoose";

const DailySixAlcoholicDrinksAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "daily_six_alcoholic_drinks_id": {
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
    collection: "daily_six_alcoholic_drinks_answers"
  }
);

const DailySixAlcoholicDrinksAnswers = mongoose.model("DailySixAlcoholicDrinksAnswers", DailySixAlcoholicDrinksAnswersSchema);
export default DailySixAlcoholicDrinksAnswers;
