import Joi from "joi";
import { withFieldLabels } from "./helpers";

export const getErrorExampleQuerySchema = Joi.object(
  withFieldLabels({
    type: Joi.string()
      .valid(
        "notfound",
        "unauthorized",
        "forbidden",
        "validation",
        "conflict",
        "badrequest"
      )
      .optional(),
  })
)
  .default({})
  .label("ExampleErrorQuery");

export const deleteExampleParamsSchema = Joi.object(
  withFieldLabels({
    id: Joi.number().integer().min(1).required(),
  })
).label("ExampleDeleteParams");
