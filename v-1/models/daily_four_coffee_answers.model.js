import mongoose from "mongoose";

const DailyFourCoffeeAnswersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "quiz_id": {
      type: Number,
      required: true,
    },
    "daily_four_coffee_id": {
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
    collection: "daily_four_coffee_answers"
  }
);

const DailyFourCoffeeAnswers = mongoose.model("DailyFourCoffeeAnswers", DailyFourCoffeeAnswersSchema);
export default DailyFourCoffeeAnswers;
