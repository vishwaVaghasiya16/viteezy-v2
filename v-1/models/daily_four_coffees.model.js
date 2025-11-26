import mongoose from "mongoose";

const DailyFourCoffeesSchema = new mongoose.Schema(
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
    collection: "daily_four_coffees"
  }
);

const DailyFourCoffees = mongoose.model("DailyFourCoffees", DailyFourCoffeesSchema);
export default DailyFourCoffees;
