import mongoose from "mongoose";

const LoginSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "email": {
      type: String,
      required: true,
    },
    "token": {
      type: String,
      required: true,
    },
    "last_updated": {
      type: Date,
      required: true,
    },
    "creation_timestamp": {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "login"
  }
);

const Login = mongoose.model("Login", LoginSchema);
export default Login;
