import mongoose from "mongoose";
import { ProductTestimonials } from "@/models/cms/productTestimonials.model";
import { SupportedLanguage } from "@/models/common.model";

/**
 * Product testimonial service - New flow for showing testimonials on specified pages
 *
 * Flow:
 * - Product Detail Page: First try testimonials where product is in productsForDetailsPage (specified pages).
 *   If none found, fallback to testimonials where product is in products (current flow).
 * - Product Listing (get all products): Show testimonials where product is in products.
 */

const SORT_OPTIONS = { isFeatured: -1, displayOrder: 1, createdAt: -1 } as const;
const BASE_FILTER = { isDeleted: { $ne: true }, isActive: true };
const POPULATE_FIELDS = "title slug productImage sachetPrices";

/**
 * Get testimonials for a single product (detail page context).
 * New flow: productsForDetailsPage first, then fallback to products.
 */
export async function getTestimonialsForProductDetail(
  productId: string,
  userLang: SupportedLanguage = "en"
): Promise<any[]> {
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return [];
  }

  const objectId = new mongoose.Types.ObjectId(productId);

  // 1. New flow: testimonials where product is in productsForDetailsPage
  let testimonials = await ProductTestimonials.find({
    ...BASE_FILTER,
    productsForDetailsPage: objectId,
  })
    .populate("products", POPULATE_FIELDS)
    .populate("productsForDetailsPage", POPULATE_FIELDS)
    .sort(SORT_OPTIONS)
    .lean();

  // 2. Fallback: if none found, use current flow (products array)
  if (!testimonials || testimonials.length === 0) {
    testimonials = await ProductTestimonials.find({
      ...BASE_FILTER,
      products: objectId,
    })
      .populate("products", POPULATE_FIELDS)
      .populate("productsForDetailsPage", POPULATE_FIELDS)
      .sort(SORT_OPTIONS)
      .lean();
  }

  return transformTestimonialProducts(testimonials as any[], userLang);
}

/**
 * Get testimonials for multiple products (listing context).
 * Uses products array (current flow) - testimonials that feature this product.
 */
export async function getTestimonialsForProductsListing(
  productIds: string[],
  userLang: SupportedLanguage = "en"
): Promise<Map<string, any[]>> {
  const result = new Map<string, any[]>();
  if (!productIds || productIds.length === 0) return result;

  const validIds = productIds
    .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (validIds.length === 0) return result;

  const testimonials = await ProductTestimonials.find({
    ...BASE_FILTER,
    products: { $in: validIds },
  })
    .populate("products", POPULATE_FIELDS)
    .populate("productsForDetailsPage", POPULATE_FIELDS)
    .sort(SORT_OPTIONS)
    .lean();

  const transformed = transformTestimonialProducts(testimonials as any[], userLang);

  // Map testimonials to each product
  for (const productId of productIds) {
    const productTestimonials = transformed.filter((t: any) =>
      (t.products || []).some(
        (p: any) => (p?._id?.toString?.() || p?.toString?.()) === productId
      )
    );
    result.set(productId, productTestimonials);
  }

  return result;
}

/**
 * Transform product titles in testimonials to user's language
 */
function transformTestimonialProducts(
  testimonials: any[],
  userLang: SupportedLanguage
): any[] {
  return testimonials.map((testimonial) => {
    const transformed = { ...testimonial };

    const transformProduct = (product: any) => {
      if (!product || typeof product !== "object") return product;
      const p = { ...product };
      if (product.title && typeof product.title === "object") {
        p.title = product.title[userLang] || product.title.en || "";
      }
      return p;
    };

    if (Array.isArray(transformed.products)) {
      transformed.products = transformed.products.map(transformProduct);
    }
    if (Array.isArray(transformed.productsForDetailsPage)) {
      transformed.productsForDetailsPage =
        transformed.productsForDetailsPage.map(transformProduct);
    }

    return transformed;
  });
}
