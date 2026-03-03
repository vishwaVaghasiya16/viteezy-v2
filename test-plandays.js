// Test getCart pricing with proper planDays handling
console.log('=== GetCart PlanDays Test ===');

// Mock cart items with different planDays
const mockCartItems = [
  {
    // SACHETS with 60-day plan (subscription change)
    isSubscriptionChange: true,
    planDays: 60,
    price: { amount: 90, taxRate: 0, currency: 'EUR' },
    quantity: 1,
    variantType: 'SACHETS',
    productId: 'product1'
  },
  {
    // SACHETS with 90-day plan (regular item)
    isSubscriptionChange: false,
    planDays: 90,
    price: { amount: 120, taxRate: 0, currency: 'EUR' },
    quantity: 1,
    variantType: 'SACHETS',
    productId: 'product2'
  },
  {
    // SACHETS with 30-day plan (regular item)
    isSubscriptionChange: false,
    planDays: 30,
    price: { amount: 50, taxRate: 0, currency: 'EUR' },
    quantity: 1,
    variantType: 'SACHETS',
    productId: 'product3'
  },
  {
    // STAND_UP_POUCH with 60 capsuleCount
    isSubscriptionChange: false,
    planDays: 60,
    price: { amount: 25, taxRate: 0, currency: 'EUR' },
    quantity: 2,
    variantType: 'STAND_UP_POUCH',
    productId: 'product4'
  },
  {
    // STAND_UP_POUCH with 30 capsuleCount
    isSubscriptionChange: false,
    planDays: 30,
    price: { amount: 20, taxRate: 0, currency: 'EUR' },
    quantity: 1,
    variantType: 'STAND_UP_POUCH',
    productId: 'product5'
  }
];

// Mock product data
const mockProducts = {
  product1: {
    sachetPrices: {
      thirtyDays: { totalAmount: 50, currency: 'EUR', taxRate: 0 },
      sixtyDays: { totalAmount: 90, currency: 'EUR', taxRate: 0 },
      ninetyDays: { totalAmount: 120, currency: 'EUR', taxRate: 0 },
      oneEightyDays: { totalAmount: 200, currency: 'EUR', taxRate: 0 }
    }
  },
  product2: {
    sachetPrices: {
      thirtyDays: { totalAmount: 50, currency: 'EUR', taxRate: 0 },
      sixtyDays: { totalAmount: 90, currency: 'EUR', taxRate: 0 },
      ninetyDays: { totalAmount: 120, currency: 'EUR', taxRate: 0 }
    }
  },
  product3: {
    sachetPrices: {
      thirtyDays: { totalAmount: 50, currency: 'EUR', taxRate: 0 },
      sixtyDays: { totalAmount: 90, currency: 'EUR', taxRate: 0 }
    }
  },
  product4: {
    standupPouchPrice: {
      count_0: { amount: 20, currency: 'EUR', taxRate: 0 }, // 30 count
      count_1: { amount: 25, currency: 'EUR', taxRate: 0 }  // 60 count
    }
  },
  product5: {
    standupPouchPrice: {
      count_0: { amount: 20, currency: 'EUR', taxRate: 0 },
      count_1: { amount: 25, currency: 'EUR', taxRate: 0 }
    }
  }
};

// Simulate the updated getCart pricing logic
function calculateItemPricing(item, product) {
  let originalAmount = 0;
  let discountedPrice = 0;
  let currency = "EUR";
  let taxRate = 0;

  if (item.variantType === 'SACHETS' && product.sachetPrices) {
    // For subscription change items, use the planDays to get correct pricing
    if (item.isSubscriptionChange && item.planDays) {
      // First, try to use the stored item price (which should be correctly calculated)
      if (item.price && item.price.amount) {
        currency = item.price.currency || "EUR";
        taxRate = item.price.taxRate || 0;
        originalAmount = item.price.amount;
        discountedPrice = item.price.amount; // For subscription change, no discount
      } else {
        // Fallback to calculating from product sachetPrices
        let selectedPlan;
        switch (item.planDays) {
          case 30:
            selectedPlan = product.sachetPrices.thirtyDays;
            break;
          case 60:
            selectedPlan = product.sachetPrices.sixtyDays;
            break;
          case 90:
            selectedPlan = product.sachetPrices.ninetyDays;
            break;
          case 180:
            selectedPlan = product.sachetPrices.oneEightyDays;
            break;
          default:
            selectedPlan = product.sachetPrices.thirtyDays;
        }
        
        if (selectedPlan) {
          currency = selectedPlan.currency || "EUR";
          taxRate = selectedPlan.taxRate || 0;
          originalAmount = selectedPlan.totalAmount || selectedPlan.amount || 0;
          discountedPrice = selectedPlan.totalAmount || selectedPlan.amount || 0;
        }
      }
    } else {
      // Regular SACHETS: Use stored planDays or default to 30 days
      let selectedPlan;
      const itemPlanDays = item.planDays || 30; // Default to 30 if not specified
      
      switch (itemPlanDays) {
        case 30:
          selectedPlan = product.sachetPrices.thirtyDays;
          break;
        case 60:
          selectedPlan = product.sachetPrices.sixtyDays;
          break;
        case 90:
          selectedPlan = product.sachetPrices.ninetyDays;
          break;
        case 180:
          selectedPlan = product.sachetPrices.oneEightyDays;
          break;
        default:
          selectedPlan = product.sachetPrices.thirtyDays;
      }
      
      if (selectedPlan) {
        currency = selectedPlan.currency || "EUR";
        taxRate = selectedPlan.taxRate || 0;
        originalAmount = selectedPlan.amount || selectedPlan.totalAmount || 0;
        discountedPrice = selectedPlan.discountedPrice || selectedPlan.amount || selectedPlan.totalAmount || 0;
      }
    }
  } else if (item.variantType === 'STAND_UP_POUCH' && product.standupPouchPrice) {
    // STAND_UP_POUCH logic - use planDays as capsuleCount
    const standupPrice = product.standupPouchPrice;
    const itemPlanDays = item.planDays || 60; // Default to 60 if not specified
    const countKey = itemPlanDays === 30 ? 'count_0' : 'count_1'; // 30 -> count_0, 60 -> count_1
    const selectedCount = standupPrice[countKey] || standupPrice.count_0 || standupPrice.count_1 || standupPrice;
    
    if (selectedCount) {
      currency = selectedCount.currency || "EUR";
      taxRate = selectedCount.taxRate || 0;
      originalAmount = selectedCount.amount || 0;
      discountedPrice = selectedCount.discountedPrice || selectedCount.amount || 0;
    }
  }

  const itemQuantity = item.quantity || 1;
  const unitPrice = discountedPrice;
  const totalPrice = unitPrice * itemQuantity;

  return {
    originalAmount,
    discountedPrice,
    currency,
    taxRate,
    unitPrice,
    totalPrice,
    itemQuantity
  };
}

// Test each item
console.log('Item-by-item pricing:');
mockCartItems.forEach((item, index) => {
  const product = mockProducts[item.productId];
  const pricing = calculateItemPricing(item, product);
  
  console.log(`\nItem ${index + 1}:`);
  console.log(`  Type: ${item.variantType}`);
  console.log(`  Plan Days: ${item.planDays}`);
  console.log(`  Quantity: ${item.quantity}`);
  console.log(`  Unit Price: €${pricing.unitPrice}`);
  console.log(`  Total Price: €${pricing.totalPrice}`);
});

// Calculate cart subtotal
let cartSubtotal = 0;
mockCartItems.forEach(item => {
  const product = mockProducts[item.productId];
  const pricing = calculateItemPricing(item, product);
  cartSubtotal += pricing.totalPrice;
});

console.log(`\nCart Subtotal: €${cartSubtotal}`);
console.log('Expected: €345 (€90 + €120 + €50 + €50 + €35)');
