import mongoose from "mongoose";

const TokensSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "token": {
      type: String,
      required: true,
    },
    "user_id": {
      type: Number,
      required: true,
    },
    "user_role": {
      type: String,
      required: true,
    },
    "last_access": {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "tokens"
  }
);

const Tokens = mongoose.model("Tokens", TokensSchema);
export default Tokens;
