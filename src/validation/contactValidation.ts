import Joi from "joi";

/**
 * Submit contact form (Ask us a question)
 * Required: subject, email, message, privacyAccepted
 */
export const submitContactSchema = Joi.object({
  subject: Joi.string().trim().required().messages({
    "string.empty": "Please choose a subject",
  }),
  name: Joi.string().trim().allow("", null).optional(),
  email: Joi.string().email().trim().lowercase().required().messages({
    "string.empty": "Email is required",
    "string.email": "Please enter a valid email address",
  }),
  phone: Joi.string().trim().allow("", null).optional(),
  message: Joi.string().trim().required().messages({
    "string.empty": "Message is required",
  }),
  privacyAccepted: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      "any.only": "You must read and accept the privacy policy",
    }),
})
  .unknown(false)
  .label("SubmitContact");

/**
 * Footer email signup (newsletter / welcome mail)
 */
export const footerSubscribeSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required().messages({
    "string.empty": "Email is required",
    "string.email": "Please enter a valid email address",
  }),
})
  .unknown(false)
  .label("FooterSubscribe");
