import Joi from "joi";
import { withFieldLabels } from "./helpers";

export const createProductTestimonialSchema = Joi.object(
  withFieldLabels({
    products: Joi.array()
      .items(Joi.string().hex().length(24))
      .min(1)
      .required()
      .label("Products"),
    isVisibleOnHomepage: Joi.boolean()
      .optional()
      .default(false)
      .label("Visible on Homepage"),
    displayOrder: Joi.number()
      .integer()
      .min(0)
      .optional()
      .default(0)
      .label("Display Order"),
    metadata: Joi.string().optional().label("Metadata"),
  })
).label("CreateProductTestimonial");

export const updateProductTestimonialSchema = Joi.object(
  withFieldLabels({
    products: Joi.array()
      .items(Joi.string().hex().length(24))
      .min(1)
      .optional()
      .label("Products"),
    isVisibleOnHomepage: Joi.boolean().optional().label("Visible on Homepage"),
    displayOrder: Joi.number()
      .integer()
      .min(0)
      .optional()
      .label("Display Order"),
    metadata: Joi.string().optional().label("Metadata"),
  })
).label("UpdateProductTestimonial");

export const productTestimonialIdParamsSchema = Joi.object(
  withFieldLabels({
    id: Joi.string().hex().length(24).required().label("Testimonial ID"),
  })
).label("ProductTestimonialIdParams");

export const listProductTestimonialsQuerySchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).optional().default(1).label("Page"),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .label("Limit"),
    search: Joi.string().optional().label("Search"),
    isVisibleOnHomepage: Joi.boolean().optional().label("Visible on Homepage"),
    isActive: Joi.boolean().optional().label("Active Status"),
  })
).label("ListProductTestimonialsQuery");
