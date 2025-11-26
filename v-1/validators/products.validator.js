import { z } from "zod";

export const productListQuery = z.object({
  page: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val))
    .pipe(z.number().int().min(1))
    .default(1),
  limit: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val))
    .pipe(z.number().int().min(1).max(100))
    .default(20),
  category: z.string().trim().min(1).optional(),
  healthGoal: z
    .union([z.string().trim().min(1), z.array(z.string().trim().min(1))])
    .optional(),
  ingredient: z
    .union([
      z.string().trim().min(1),
      z.array(z.string().trim().min(1)),
      z.number(),
      z.array(z.number()),
    ])
    .optional(),
  pouchType: z.string().trim().min(1).optional(),
  sort: z.enum(["relevance", "price", "popularity"]).default("relevance"),
  order: z.enum(["asc", "desc"]).optional(),
});
