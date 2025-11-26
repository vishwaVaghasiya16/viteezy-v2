import mongoose from "mongoose";

const CustomersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "email": {
      type: String,
      required: true,
    },
    "opt_in": {
      type: Boolean,
      required: false,
      default: false,
    },
    "external_reference": {
      type: String,
      required: true,
    },
    "mollie_customer_id": {
      type: String,
      required: false,
    },
    "ga_id": {
      type: String,
      required: false,
    },
    "facebook_pixel": {
      type: String,
      required: false,
    },
    "user_agent": {
      type: String,
      required: false,
    },
    "address": {
      type: String,
      required: false,
    },
    "active_campaign_contact_id": {
      type: Number,
      required: false,
    },
    "active_campaign_ecom_customer_id": {
      type: Number,
      required: false,
    },
    "klaviyo_profile_id": {
      type: String,
      required: false,
    },
    "creation_date": {
      type: Date,
      required: true,
    },
    "last_modified": {
      type: Date,
      required: true,
    },
    "first_name": {
      type: String,
      required: false,
    },
    "last_name": {
      type: String,
      required: false,
    },
    "phone_number": {
      type: String,
      required: false,
    },
    "postcode": {
      type: String,
      required: false,
    },
    "city": {
      type: String,
      required: false,
    },
    "street": {
      type: String,
      required: false,
    },
    "house_number": {
      type: Number,
      required: false,
    },
    "house_number_addition": {
      type: String,
      required: false,
    },
    "country": {
      type: String,
      required: false,
    },
    "referral_code": {
      type: String,
      required: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "customers"
  }
);

const Customers = mongoose.model("Customers", CustomersSchema);
export default Customers;
