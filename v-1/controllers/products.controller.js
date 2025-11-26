import { listProducts } from "../services/product.service.js";
import { productListQuery } from "../validators/products.validator.js";

export const getProducts = async (req, res, next) => {
  try {
    const filters = productListQuery.parse(req.query);
    const result = await listProducts(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
