import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Orders, Payments, Products, Coupons } from "@/models/commerce";
import { Addresses } from "@/models/core";
import { CouponType, OrderPlanType, SubscriptionCycle } from "@/models/enums";
import { PriceType } from "@/models/common.model";
import {
  getSubscriptionPriceFromProduct,
  getBaseSubtotalForSubscription,
} from "@/utils/productSubscriptionPrice";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

interface MembershipPayload {
  isMember?: boolean;
  membershipId?: string;
  level?: string;
  label?: string;
  discountType?: "Percentage" | "Fixed";
  discountValue?: number;
  metadata?: Record<string, any>;
}

interface CouponCalculationInput {
  couponCode: string;
  userId: string;
  orderAmount: number;
  shippingAmount: number;
  productIds: string[];
  categoryIds: string[];
}

interface CouponCalculationResult {
  discountAmount: number;
  metadata?: Record<string, any>;
  shippingDiscount?: number;
}

const roundAmount = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const createPrice = (
  amount: number,
  currency: string,
  taxRate = 0
): PriceType => ({
  amount: roundAmount(amount),
  currency,
  taxRate,
});

const generateOrderNumber = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `VTZ-${timestamp}-${random}`;
};

const calculateMembershipDiscount = (
  subtotal: number,
  membership?: MembershipPayload
): { amount: number; metadata?: Record<string, any> } => {
  if (!membership?.isMember || !membership.discountValue) {
    return { amount: 0 };
  }

  let discountAmount = 0;
  if (membership.discountType === "Fixed") {
    discountAmount = membership.discountValue;
  } else {
    discountAmount = (subtotal * membership.discountValue) / 100;
  }

  discountAmount = Math.min(discountAmount, subtotal);

  return {
    amount: roundAmount(discountAmount),
    metadata: {
      membershipId: membership.membershipId,
      level: membership.level,
      label: membership.label,
      discountType: membership.discountType,
      discountValue: membership.discountValue,
      ...membership.metadata,
    },
  };
};

/**
 * Calculate 15% discount for 90-day subscription plans
 * This discount applies to the base subtotal amount
 */
const calculate90DaySubscriptionDiscount = (
  subtotal: number,
  planType: OrderPlanType,
  cycleDays?: number
): { amount: number; metadata?: Record<string, any> } => {
  // Only apply discount for subscription plans with 90-day cycle
  if (planType !== OrderPlanType.SUBSCRIPTION || cycleDays !== 90) {
    return { amount: 0 };
  }

  // Apply 15% discount to subtotal
  const discountAmount = (subtotal * 15) / 100;
  const finalDiscountAmount = Math.min(discountAmount, subtotal);

  return {
    amount: roundAmount(finalDiscountAmount),
    metadata: {
      discountType: "90-Day Subscription Discount",
      discountPercentage: 15,
      cycleDays: 90,
      appliedTo: "subtotal",
    },
  };
};

const validateCouponForOrder = async ({
  couponCode,
  userId,
  orderAmount,
  shippingAmount,
  productIds,
  categoryIds,
}: CouponCalculationInput): Promise<CouponCalculationResult> => {
  const coupon = await Coupons.findOne({
    code: couponCode,
    isDeleted: false,
  }).lean();

  if (!coupon) {
    throw new AppError("Invalid coupon code", 404);
  }

  if (!coupon.isActive) {
    throw new AppError("This coupon is not active", 400);
  }

  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) {
    throw new AppError("This coupon is not yet valid", 400);
  }
  if (coupon.validUntil && now > coupon.validUntil) {
    throw new AppError("This coupon has expired", 400);
  }

  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    throw new AppError("This coupon has reached its usage limit", 400);
  }

  if (coupon.userUsageLimit) {
    const userUsageCount = await Orders.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      couponCode: coupon.code,
      isDeleted: false,
    });

    if (userUsageCount >= coupon.userUsageLimit) {
      throw new AppError(
        "You have reached the maximum usage limit for this coupon",
        400
      );
    }
  }

  if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
    throw new AppError(
      `Minimum order amount of ${coupon.minOrderAmount} is required for this coupon`,
      400
    );
  }

  if (
    coupon.applicableProducts &&
    coupon.applicableProducts.length > 0 &&
    !productIds.some((id) =>
      coupon.applicableProducts
        .map((productId) => productId.toString())
        .includes(id)
    )
  ) {
    throw new AppError(
      "This coupon is not applicable to the selected products",
      400
    );
  }

  if (
    coupon.applicableCategories &&
    coupon.applicableCategories.length > 0 &&
    !categoryIds.some((id) =>
      coupon.applicableCategories
        .map((categoryId) => categoryId.toString())
        .includes(id)
    )
  ) {
    throw new AppError(
      "This coupon is not applicable to the selected categories",
      400
    );
  }

  if (
    coupon.excludedProducts &&
    coupon.excludedProducts.length > 0 &&
    productIds.some((id) =>
      coupon.excludedProducts
        .map((productId) => productId.toString())
        .includes(id)
    )
  ) {
    throw new AppError(
      "This coupon cannot be applied to one or more selected products",
      400
    );
  }

  let discountAmount = 0;
  let shippingDiscount = 0;

  if (coupon.type === CouponType.PERCENTAGE) {
    discountAmount = (orderAmount * coupon.value) / 100;
    if (coupon.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
    }
  } else if (coupon.type === CouponType.FIXED) {
    discountAmount = Math.min(coupon.value, orderAmount);
  } else if (coupon.type === CouponType.FREE_SHIPPING) {
    shippingDiscount = Math.min(shippingAmount, shippingAmount);
    discountAmount = shippingDiscount;
  }

  return {
    discountAmount: roundAmount(discountAmount),
    shippingDiscount: roundAmount(shippingDiscount),
    metadata: {
      type: coupon.type,
      value: coupon.value,
      minOrderAmount: coupon.minOrderAmount,
      maxDiscountAmount: coupon.maxDiscountAmount,
      name: coupon.name,
    },
  };
};

class OrderController {
  /**
   * Create a new order before payment redirection
   * @route POST /api/orders
   * @access Private
   */
  createOrder = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const {
        items,
        shippingAddressId,
        billingAddressId,
        shippingAmount,
        taxAmount,
        couponCode,
        membership,
        plan,
        metadata,
        paymentMethod,
        notes,
      } = req.body;

      const userId = new mongoose.Types.ObjectId(req.user._id);

      // Validate and fetch shipping address
      if (!shippingAddressId) {
        throw new AppError("Shipping address ID is required", 400);
      }

      if (!mongoose.Types.ObjectId.isValid(shippingAddressId)) {
        throw new AppError("Invalid shipping address ID format", 400);
      }

      const shippingAddressDoc = await Addresses.findOne({
        _id: new mongoose.Types.ObjectId(shippingAddressId),
        userId: userId,
        isDeleted: false,
      }).lean();

      if (!shippingAddressDoc) {
        throw new AppError(
          "Shipping address not found or does not belong to user",
          404
        );
      }

      // Validate billing address if provided
      if (billingAddressId) {
        if (!mongoose.Types.ObjectId.isValid(billingAddressId)) {
          throw new AppError("Invalid billing address ID format", 400);
        }

        const billingAddressDoc = await Addresses.findOne({
          _id: new mongoose.Types.ObjectId(billingAddressId),
          userId: userId,
          isDeleted: false,
        }).lean();

        if (!billingAddressDoc) {
          throw new AppError(
            "Billing address not found or does not belong to user",
            404
          );
        }
      }

      const productObjectIds = items.map(
        (item: any) => new mongoose.Types.ObjectId(item.productId)
      );

      // Determine plan type and cycle days early
      const planType: OrderPlanType = plan?.type || OrderPlanType.ONE_TIME;
      const cycleDays =
        plan?.interval || plan?.cycleDays || plan?.metadata?.cycleDays;

      // For subscription orders, we need sachetPrices to get the correct subscription price
      const selectFields =
        planType === OrderPlanType.SUBSCRIPTION
          ? "title slug skuRoot categories sachetPrices price variant"
          : "title slug skuRoot categories price variant";

      const products = await Products.find({
        _id: { $in: productObjectIds },
        isDeleted: false,
      })
        .select(selectFields)
        .lean();

      if (products.length !== productObjectIds.length) {
        throw new AppError("One or more products are unavailable", 400);
      }

      const productMap = new Map(
        products.map((product: any) => [product._id.toString(), product])
      );

      let currency =
        items[0]?.price?.currency?.toUpperCase() ||
        shippingAmount?.currency ||
        taxAmount?.currency ||
        "EUR";
      currency = currency.toUpperCase();

      const categoryIds = new Set<string>();

      products.forEach((product: any) => {
        (product.categories || []).forEach(
          (categoryId: mongoose.Types.ObjectId) =>
            categoryIds.add(categoryId.toString())
        );
      });

      const orderItems = items.map((item: any) => {
        const product = productMap.get(item.productId);

        if (!product) {
          throw new AppError("Invalid product in order items", 400);
        }

        let itemPrice: PriceType;

        // For subscription orders, use price from sachetPrices based on cycleDays
        if (
          planType === OrderPlanType.SUBSCRIPTION &&
          cycleDays &&
          product.sachetPrices
        ) {
          try {
            // Validate cycleDays is a valid SubscriptionCycle
            const validCycleDays = cycleDays as SubscriptionCycle;
            if (![60, 90, 180].includes(validCycleDays)) {
              throw new AppError(
                `Invalid cycle days: ${cycleDays}. Must be 60, 90, or 180`,
                400
              );
            }

            // Get subscription price from product's sachetPrices
            itemPrice = getSubscriptionPriceFromProduct(
              product,
              validCycleDays
            );
          } catch (error: any) {
            // If subscription price not found, fall back to provided price
            if (error instanceof AppError) {
              throw error;
            }
            itemPrice = createPrice(
              item.price.amount,
              item.price.currency || currency,
              item.price.taxRate ?? 0
            );
          }
        } else {
          // For one-time orders or if price is explicitly provided, use provided price
          itemPrice = createPrice(
            item.price.amount,
            item.price.currency || currency,
            item.price.taxRate ?? 0
          );
        }

        const itemCurrency = itemPrice.currency.toUpperCase();
        if (itemCurrency !== currency) {
          throw new AppError("All item prices must use the same currency", 400);
        }

        const variantId = item.variantId
          ? new mongoose.Types.ObjectId(item.variantId)
          : undefined;

        return {
          productId: new mongoose.Types.ObjectId(item.productId),
          variantId,
          quantity: item.quantity,
          price: itemPrice,
          name:
            item.name ||
            product.title?.en ||
            product.title?.nl ||
            product.slug ||
            "Product",
        };
      });

      const subtotalAmount = orderItems.reduce(
        (sum: number, item: any) => sum + item.price.amount * item.quantity,
        0
      );

      const shippingInput = shippingAmount || {
        amount: 0,
        currency,
        taxRate: 0,
      };
      const taxInput = taxAmount || {
        amount: 0,
        currency,
        taxRate: 0,
      };

      if (
        shippingInput.currency &&
        shippingInput.currency.toUpperCase() !== currency
      ) {
        throw new AppError(
          "Shipping amount currency must match item currency",
          400
        );
      }

      if (taxInput.currency && taxInput.currency.toUpperCase() !== currency) {
        throw new AppError("Tax amount currency must match item currency", 400);
      }

      let shippingAmountValue = shippingInput.amount || 0;
      const shippingTaxRate = shippingInput.taxRate ?? 0;
      const taxAmountValue = taxInput.amount || 0;
      const taxRateValue = taxInput.taxRate ?? 0;

      // Calculate 90-day subscription discount (applied to base subtotal)
      // For subscription orders, the subtotalAmount already uses prices from sachetPrices
      const subscriptionPlanDiscountResult = calculate90DaySubscriptionDiscount(
        subtotalAmount,
        planType,
        cycleDays
      );

      // Calculate membership discount (applied to subtotal after subscription discount)
      const subtotalAfterSubscriptionDiscount = Math.max(
        subtotalAmount - subscriptionPlanDiscountResult.amount,
        0
      );
      const membershipResult = calculateMembershipDiscount(
        subtotalAfterSubscriptionDiscount,
        membership
      );

      const normalizedCouponCode = couponCode
        ? couponCode.toUpperCase()
        : undefined;

      let couponDiscountAmount = 0;
      let couponMetadata: Record<string, any> | undefined;

      // Calculate coupon discount on subtotal after subscription and membership discounts
      const subtotalAfterAllDiscounts = Math.max(
        subtotalAfterSubscriptionDiscount - membershipResult.amount,
        0
      );

      if (normalizedCouponCode) {
        const couponResult = await validateCouponForOrder({
          couponCode: normalizedCouponCode,
          userId: req.user._id,
          orderAmount: subtotalAfterAllDiscounts,
          shippingAmount: shippingAmountValue,
          productIds: productObjectIds.map((id: mongoose.Types.ObjectId) =>
            id.toString()
          ),
          categoryIds: Array.from(categoryIds),
        });

        couponDiscountAmount = couponResult.discountAmount;
        couponMetadata = couponResult.metadata;
        if (couponResult.shippingDiscount) {
          shippingAmountValue = Math.max(
            shippingAmountValue - couponResult.shippingDiscount,
            0
          );
        }
      }

      const totalDiscountAmount =
        subscriptionPlanDiscountResult.amount +
        membershipResult.amount +
        couponDiscountAmount;

      const subtotalPrice = createPrice(subtotalAmount, currency);
      const shippingPrice = createPrice(
        shippingAmountValue,
        currency,
        shippingTaxRate
      );
      const taxPrice = createPrice(taxAmountValue, currency, taxRateValue);
      const discountPrice = createPrice(totalDiscountAmount, currency);
      const couponDiscountPrice = createPrice(couponDiscountAmount, currency);
      const membershipDiscountPrice = createPrice(
        membershipResult.amount,
        currency
      );
      const subscriptionPlanDiscountPrice = createPrice(
        subscriptionPlanDiscountResult.amount,
        currency
      );

      const totalAmount = Math.max(
        subtotalAmount -
          totalDiscountAmount +
          taxAmountValue +
          shippingAmountValue,
        0
      );
      const totalPrice = createPrice(totalAmount, currency);

      const orderMetadata: Record<string, any> = {
        ...(metadata || {}),
      };

      const planDetails: Record<string, any> = {
        interval: plan?.interval,
        startDate: plan?.startDate,
        trialDays: plan?.trialDays,
        ...(plan?.metadata || {}),
      };

      const sanitizedPlanDetails = Object.entries(planDetails).reduce(
        (acc, [key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, any>
      );

      if (Object.keys(sanitizedPlanDetails).length > 0) {
        orderMetadata.planDetails = sanitizedPlanDetails;
      }

      // Store subscription plan discount metadata in order metadata
      if (subscriptionPlanDiscountResult.amount > 0) {
        orderMetadata.subscriptionPlanDiscount =
          subscriptionPlanDiscountResult.metadata;
      }

      const order = await Orders.create({
        orderNumber: generateOrderNumber(),
        userId,
        planType,
        items: orderItems,
        subtotal: subtotalPrice,
        tax: taxPrice,
        shipping: shippingPrice,
        discount: discountPrice,
        couponDiscount: couponDiscountPrice,
        membershipDiscount: membershipDiscountPrice,
        subscriptionPlanDiscount: subscriptionPlanDiscountPrice,
        total: totalPrice,
        shippingAddressId: new mongoose.Types.ObjectId(shippingAddressId),
        billingAddressId: billingAddressId
          ? new mongoose.Types.ObjectId(billingAddressId)
          : undefined,
        paymentMethod,
        couponCode: normalizedCouponCode,
        couponMetadata: couponMetadata || {},
        membershipMetadata: membershipResult.metadata || {},
        metadata: orderMetadata,
        notes,
      });

      const orderData = order.toObject();

      res.apiCreated(
        {
          order: {
            id: orderData._id,
            orderNumber: orderData.orderNumber,
            planType: orderData.planType,
            couponCode: orderData.couponCode,
            totals: {
              subtotal: orderData.subtotal,
              tax: orderData.tax,
              shipping: orderData.shipping,
              discount: orderData.discount,
              couponDiscount: orderData.couponDiscount,
              membershipDiscount: orderData.membershipDiscount,
              subscriptionPlanDiscount: orderData.subscriptionPlanDiscount,
              total: orderData.total,
            },
            metadata: orderData.metadata,
            couponMetadata: orderData.couponMetadata,
            membershipMetadata: orderData.membershipMetadata,
          },
        },
        "Order created successfully"
      );
    }
  );

  /**
   * Get order history for authenticated user (Paginated)
   * @route GET /api/orders
   * @access Private
   */
  getOrderHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { status, paymentStatus, startDate, endDate } = req.query;

      // Build filter for user's orders
      const filter: any = {
        userId: new mongoose.Types.ObjectId(req.user._id),
        isDeleted: false,
      };

      // Filter by order status
      if (status) {
        filter.status = status;
      }

      // Filter by payment status
      if (paymentStatus) {
        filter.paymentStatus = paymentStatus;
      }

      // Filter by date range
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          filter.createdAt.$gte = new Date(startDate as string);
        }
        if (endDate) {
          filter.createdAt.$lte = new Date(endDate as string);
        }
      }

      // Default sort by latest orders
      const sortOptions: any = { createdAt: -1 };
      if (sort && typeof sort === "object") {
        Object.assign(sortOptions, sort);
      }

      // Get total count
      const total = await Orders.countDocuments(filter);

      // Get orders with pagination
      const orders = await Orders.find(filter)
        .select(
          "orderNumber planType status items subtotal tax shipping discount couponDiscount membershipDiscount subscriptionPlanDiscount total paymentMethod paymentStatus couponCode metadata couponMetadata membershipMetadata trackingNumber shippedAt deliveredAt createdAt"
        )
        .populate(
          "items.productId",
          "title slug description media categories tags status galleryImages productImage"
        )
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

      // Transform orders for response
      const transformedOrders = orders.map((order: any) => ({
        id: order._id,
        orderNumber: order.orderNumber,
        planType: order.planType,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: order.items.map((item: any) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          name: item.name,
          price: item.price,
        })),
        pricing: {
          subtotal: order.subtotal,
          tax: order.tax,
          shipping: order.shipping,
          discount: order.discount,
          couponDiscount: order.couponDiscount,
          membershipDiscount: order.membershipDiscount,
          subscriptionPlanDiscount: order.subscriptionPlanDiscount,
          total: order.total,
        },
        couponCode: order.couponCode,
        couponMetadata: order.couponMetadata,
        membershipMetadata: order.membershipMetadata,
        metadata: order.metadata,
        paymentMethod: order.paymentMethod,
        trackingNumber: order.trackingNumber,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        createdAt: order.createdAt,
      }));

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(transformedOrders, pagination, "Orders retrieved");
    }
  );

  /**
   * Get order details by ID
   * Includes product details, payment data, and shipping address
   * @route GET /api/orders/:orderId
   * @access Private
   */
  getOrderDetails = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { orderId } = req.params;

      // Validate orderId
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        throw new AppError("Invalid order ID", 400);
      }

      // Get order with populated addresses
      const order = await Orders.findOne({
        _id: new mongoose.Types.ObjectId(orderId),
        userId: new mongoose.Types.ObjectId(req.user._id),
        isDeleted: false,
      })
        .populate(
          "shippingAddressId",
          "firstName lastName streetName houseNumber houseNumberAddition postalCode address phone city country note"
        )
        .populate(
          "billingAddressId",
          "firstName lastName streetName houseNumber houseNumberAddition postalCode address phone city country note"
        )
        .lean();

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      // Get payment details for this order
      let paymentData = null;
      const payment = await Payments.findOne({
        orderId: new mongoose.Types.ObjectId(orderId),
        userId: new mongoose.Types.ObjectId(req.user._id),
        isDeleted: false,
      })
        .select(
          "paymentMethod status amount currency transactionId gatewayTransactionId gatewayResponse failureReason refundAmount refundReason refundedAt processedAt createdAt"
        )
        .lean();

      if (payment) {
        paymentData = {
          id: payment._id,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          transactionId: payment.transactionId,
          gatewayTransactionId: payment.gatewayTransactionId,
          failureReason: payment.failureReason,
          refundAmount: payment.refundAmount,
          refundReason: payment.refundReason,
          refundedAt: payment.refundedAt,
          processedAt: payment.processedAt,
          createdAt: payment.createdAt,
        };
      }

      // Get all product IDs from order items
      const productIds = order.items
        .map((item: any) => item.productId)
        .filter((id: any) => id && mongoose.Types.ObjectId.isValid(id))
        .map((id: any) => new mongoose.Types.ObjectId(id));

      // Fetch all products in one query
      const products = await Products.find({
        _id: { $in: productIds },
        isDeleted: false,
      })
        .select(
          "title slug description media categories tags status galleryImages productImage"
        )
        .lean();

      // Create a map for quick lookup
      const productMap = new Map(
        products.map((p: any) => [p._id.toString(), p])
      );

      // Transform order items with product details
      const itemsWithProducts = order.items.map((item: any) => {
        const product = item.productId
          ? productMap.get(item.productId.toString())
          : null;

        return {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          name: item.name,
          price: item.price,
          product: product
            ? {
                id: product._id,
                title: product.title,
                slug: product.slug,
                description: product.description,
                media: product.media,
                categories: product.categories,
                tags: product.tags,
                status: product.status,
                galleryImages: product.galleryImages,
                productImage: product.productImage,
              }
            : null,
        };
      });

      // Build response
      const orderDetails = {
        id: order._id,
        orderNumber: order.orderNumber,
        planType: order.planType,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: itemsWithProducts,
        pricing: {
          subtotal: order.subtotal,
          tax: order.tax,
          shipping: order.shipping,
          discount: order.discount,
          couponDiscount: order.couponDiscount,
          membershipDiscount: order.membershipDiscount,
          subscriptionPlanDiscount: order.subscriptionPlanDiscount,
          total: order.total,
        },
        shippingAddressId: order.shippingAddressId,
        billingAddressId: order.billingAddressId,
        paymentMethod: order.paymentMethod,
        payment: paymentData,
        couponCode: order.couponCode,
        couponMetadata: order.couponMetadata,
        couponDiscount: order.couponDiscount,
        membershipDiscount: order.membershipDiscount,
        membershipMetadata: order.membershipMetadata,
        notes: order.notes,
        metadata: order.metadata,
        trackingNumber: order.trackingNumber,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };

      res.apiSuccess(
        { order: orderDetails },
        "Order details retrieved successfully"
      );
    }
  );
}

export const orderController = new OrderController();
