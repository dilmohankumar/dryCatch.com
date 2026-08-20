import { calculate as percentageCalculate } from "./percentageStrategy.js";
import { calculate as fixedAmountCalculate } from "./fixedAmountStrategy.js";
import { calculate as freeShippingCalculate } from "./freeShippingStrategy.js";
import { calculate as buyXGetYCalculate } from "./buyXGetYStrategy.js";

// Strategy pattern (rule #55): adding a new discount type is "write a new
// file + add one line here," never touching promotionEngine.js's control
// flow, CartService, CheckoutService, or OrderService.
const STRATEGIES = {
  PERCENTAGE: percentageCalculate,
  FIXED_AMOUNT: fixedAmountCalculate,
  FREE_SHIPPING: freeShippingCalculate,
  BUY_X_GET_Y: buyXGetYCalculate,
  BUY_X_GET_PERCENTAGE: buyXGetYCalculate,
  BUY_X_GET_FIXED_PRICE: buyXGetYCalculate,
};

export function getStrategy(type) {
  const strategy = STRATEGIES[type];
  if (!strategy) throw Object.assign(new Error(`Unknown promotion type: ${type}`), { statusCode: 500 });
  return strategy;
}
