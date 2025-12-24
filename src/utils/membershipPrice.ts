/**
 * @fileoverview Membership Price Calculation Utility
 * @description Reusable helper functions for calculating member prices with discounts
 * @module utils/membershipPrice
 */

import mongoose from "mongoose";
import { PriceType } from "../models/common.model";
import { User } from "../models/core/users.model";
import { MembershipPlans } from "../models/commerce/membershipPlans.model";
import { MembershipStatus } from "../models/enums";

export interface MemberPriceResult {
  originalPrice: PriceType;
  memberPrice: PriceType;
  discountAmount: number;
  discountPercentage: number;
  isMember: boolean;
  appliedDiscount?: {
    type: "universal" | "product_override";
    value: number;
  };
}

export interface ProductPriceSource {
  price: PriceType;
  memberPrice?: PriceType; // Optional product-specific member price override
  memberDiscountOverride?: {
    type: "percentage" | "fixed";
    value: number;
  };
}

/**
 * Extract discount percentage from membership plan benefits
 * Looks for patterns like "10% discount", "15% off", etc.
 */
function extractDiscountFromBenefits(benefits: string[]): number | null {
  if (!benefits || benefits.length === 0) {
    return null;
  }

  const discountPattern = /(\d+(?:\.\d+)?)\s*%\s*(?:discount|off|reduction)/i;

  for (const benefit of benefits) {
    const match = benefit.match(discountPattern);
    if (match) {
      const discount = parseFloat(match[1]);
      if (discount > 0 && discount <= 100) {
        return discount;
      }
    }
  }

  return null;
}

/**
 * Check if user is an active member
 */
async function isActiveMember(userId: string): Promise<boolean> {
  try {
    const user = await User.findById(userId)
      .select("isMember membershipStatus membershipExpiresAt membershipPlanId")
      .lean();

    if (!user) {
      return false;
    }

    // Check if user has active membership
    if (!user.isMember || user.membershipStatus !== MembershipStatus.ACTIVE) {
      return false;
    }

    // Check if membership hasn't expired
    if (user.membershipExpiresAt && user.membershipExpiresAt < new Date()) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get user's membership plan discount percentage
 */
async function getMembershipDiscount(userId: string): Promise<number | null> {
  try {
    const user = await User.findById(userId)
      .select("membershipPlanId membershipStatus membershipExpiresAt")
      .lean();

    if (!user || !user.membershipPlanId) {
      return null;
    }

    // Check if membership is active
    if (user.membershipStatus !== MembershipStatus.ACTIVE) {
      return null;
    }

    if (user.membershipExpiresAt && user.membershipExpiresAt < new Date()) {
      return null;
    }

    // Get membership plan
    const plan = await MembershipPlans.findById(user.membershipPlanId)
      .select("benefits metadata discountPercentage")
      .lean();

    if (!plan) {
      return null;
    }

    // Try to get discount from explicit field first (table column)
    if (
      typeof (plan as any).discountPercentage === "number" &&
      (plan as any).discountPercentage > 0
    ) {
      return (plan as any).discountPercentage;
    }

    // Fallback: try to get discount from metadata (backward compatibility)
    if (plan.metadata && typeof plan.metadata === "object") {
      const metadata = plan.metadata as Record<string, any>;
      if (
        typeof metadata.discountPercentage === "number" &&
        metadata.discountPercentage > 0
      ) {
        return metadata.discountPercentage;
      }
    }

    // Fallback to extracting from benefits
    return extractDiscountFromBenefits(plan.benefits || []);
  } catch (error) {
    return null;
  }
}

/**
 * Round amount to 2 decimal places
 */
function roundAmount(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate member price for a product
 *
 * Priority order:
 * 1. Product-specific member price override (if exists)
 * 2. Product-specific discount override (if exists)
 * 3. Universal membership discount from plan
 *
 * @param product - Product with price information
 * @param user - User object or userId string
 * @returns MemberPriceResult with original and member prices
 */
export async function calculateMemberPrice(
  product: ProductPriceSource,
  user: any | string
): Promise<MemberPriceResult> {
  const originalPrice = product.price;
  const userId = typeof user === "string" ? user : user?._id || user?.id;

  // Initialize result with original price
  const result: MemberPriceResult = {
    originalPrice,
    memberPrice: { ...originalPrice },
    discountAmount: 0,
    discountPercentage: 0,
    isMember: false,
  };

  // If no user ID provided, return original price
  if (!userId) {
    return result;
  }

  // Check if user is an active member
  const isMember = await isActiveMember(userId);
  result.isMember = isMember;

  if (!isMember) {
    return result;
  }

  // Priority 1: Check for product-specific member price override
  if (product.memberPrice) {
    result.memberPrice = { ...product.memberPrice };
    result.discountAmount = roundAmount(
      originalPrice.amount - product.memberPrice.amount
    );
    result.discountPercentage = roundAmount(
      (result.discountAmount / originalPrice.amount) * 100
    );
    result.appliedDiscount = {
      type: "product_override",
      value: result.discountPercentage,
    };
    return result;
  }

  // Priority 2: Check for product-specific discount override
  if (product.memberDiscountOverride) {
    const override = product.memberDiscountOverride;
    let discountAmount = 0;

    if (override.type === "percentage") {
      discountAmount = (originalPrice.amount * override.value) / 100;
    } else if (override.type === "fixed") {
      discountAmount = Math.min(override.value, originalPrice.amount);
    }

    const memberAmount = Math.max(0, originalPrice.amount - discountAmount);
    result.memberPrice = {
      currency: originalPrice.currency,
      amount: roundAmount(memberAmount),
      taxRate: originalPrice.taxRate,
    };
    result.discountAmount = roundAmount(discountAmount);
    result.discountPercentage = roundAmount(
      (result.discountAmount / originalPrice.amount) * 100
    );
    result.appliedDiscount = {
      type: "product_override",
      value:
        override.type === "percentage"
          ? override.value
          : result.discountPercentage,
    };
    return result;
  }

  // Priority 3: Apply universal membership discount
  const universalDiscount = await getMembershipDiscount(userId);
  if (universalDiscount && universalDiscount > 0) {
    const discountAmount = (originalPrice.amount * universalDiscount) / 100;
    const memberAmount = Math.max(0, originalPrice.amount - discountAmount);
    result.memberPrice = {
      currency: originalPrice.currency,
      amount: roundAmount(memberAmount),
      taxRate: originalPrice.taxRate,
    };
    result.discountAmount = roundAmount(discountAmount);
    result.discountPercentage = roundAmount(universalDiscount);
    result.appliedDiscount = {
      type: "universal",
      value: universalDiscount,
    };
    return result;
  }

  // No discount applicable, return original price
  return result;
}

/**
 * Calculate member prices for multiple products (batch processing)
 */
export async function calculateMemberPrices(
  products: ProductPriceSource[],
  user: any | string
): Promise<MemberPriceResult[]> {
  const results = await Promise.all(
    products.map((product) => calculateMemberPrice(product, user))
  );
  return results;
}
