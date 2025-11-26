import mongoose from "mongoose";

const UsersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "email": {
      type: String,
      required: true,
    },
    "password": {
      type: String,
      required: true,
    },
    "first_name": {
      type: String,
      required: true,
    },
    "last_name": {
      type: String,
      required: true,
    },
    "creation_date": {
      type: Date,
      required: true,
    },
    "role": {
      type: String,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "users"
  }
);

const Users = mongoose.model("Users", UsersSchema);
export default Users;
