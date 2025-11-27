import Joi from "joi";

const humanizeKey = (key: string): string => {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const withFieldLabels = <T extends Record<string, Joi.Schema>>(
  fields: T
): T => {
  return Object.fromEntries(
    Object.entries(fields).map(([key, schema]) => {
      const hasLabel = (schema as any)?._flags?.label;
      const labeledSchema = hasLabel ? schema : schema.label(humanizeKey(key));
      return [key, labeledSchema];
    })
  ) as T;
};
