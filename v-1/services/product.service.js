import Product from "../models/products.model.js";
import ProductIngredients from "../models/product_ingredients.model.js";
import Ingredients from "../models/ingredients.model.js";

const SORT_MAP = {
  relevance: { "ranking.relevanceScore": -1, createdAt: -1 },
  price: { "pricing.mrp": 1 },
  popularity: { "stats.popularityScore": -1 },
};

const normalizeList = (value) => {
  if (value === undefined || value === null) return undefined;
  return Array.isArray(value) ? value : [value];
};

export const listProducts = async ({
  page = 1,
  limit = 20,
  category,
  healthGoal,
  ingredient,
  pouchType,
  sort = "relevance",
  order,
}) => {
  const safePage = Number(page) > 0 ? Number(page) : 1;
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const baseMatch = { is_active: true };
  if (category) baseMatch.category = category;
  if (pouchType) baseMatch.pouch_type = pouchType;

  const pipeline = [{ $match: baseMatch }];

  pipeline.push(
    {
      $lookup: {
        from: ProductIngredients.collection.name,
        localField: "id",
        foreignField: "product_id",
        as: "ingredientLinks",
      },
    },
    {
      $lookup: {
        from: Ingredients.collection.name,
        localField: "ingredientLinks.ingredient_id",
        foreignField: "id",
        as: "ingredients",
      },
    },
    {
      $addFields: {
        ingredientIds: {
          $ifNull: ["$ingredientLinks.ingredient_id", []],
        },
        healthGoals: { $ifNull: ["$health_goals", []] },
        pouchType: { $ifNull: ["$pouch_type", null] },
        pricing: { $ifNull: ["$pricing", {}] },
        ranking: { $ifNull: ["$ranking", {}] },
        stats: { $ifNull: ["$stats", {}] },
      },
    }
  );

  const ingredientFilter = normalizeList(ingredient)?.map((val) => Number(val));
  if (ingredientFilter?.length) {
    pipeline.push({
      $match: {
        ingredientIds: { $in: ingredientFilter },
      },
    });
  }

  const healthGoalFilter = normalizeList(healthGoal);
  if (healthGoalFilter?.length) {
    pipeline.push({
      $match: {
        healthGoals: { $in: healthGoalFilter },
      },
    });
  }

  const sortKey = SORT_MAP[sort] ? { ...SORT_MAP[sort] } : { createdAt: -1 };
  if (order === "asc" || order === "desc") {
    const dir = order === "asc" ? 1 : -1;
    Object.keys(sortKey).forEach((field) => {
      sortKey[field] = dir;
    });
  }

  pipeline.push(
    { $sort: sortKey },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: safeLimit }],
        meta: [{ $count: "total" }],
      },
    },
    {
      $addFields: {
        data: { $ifNull: ["$data", []] },
        meta: {
          $ifNull: [
            "$meta",
            [
              {
                total: 0,
              },
            ],
          ],
        },
      },
    }
  );

  const [result] = await Product.aggregate(pipeline);
  const total = result?.meta?.[0]?.total || 0;
  const totalPages = Math.ceil(total / safeLimit) || 0;

  return {
    data: result?.data ?? [],
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
  };
};
