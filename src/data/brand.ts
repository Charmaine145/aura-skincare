import type { Order } from "@/types";
import { orders as auraOrders, vedaOrders } from "./orders";

/**
 * Every brand Aria serves. One agent and one policy engine; each brand brings its own facts,
 * policy numbers, orders and greetings. A call is bound to one brand in its signed session, so
 * it can only see that brand's orders and is judged by that brand's rules.
 */

export type BrandId = "aura" | "veda";

export interface BrandPolicy {
  /** Returns accepted within this many days of delivery (unopened, unused, original packaging). */
  returnDays: number;
  /** Damaged or defective items must be reported within this many hours of delivery. */
  damageHours: number;
  /** Cash on Delivery for orders up to this value, inclusive (rupees). */
  codLimit: number;
  /** Free delivery above this order value (rupees); below it, `shippingFee`. */
  freeShippingAbove: number;
  shippingFee: number;
  /** Standard delivery time, e.g. [3, 5] business days. */
  deliveryDays: [number, number];
}

export interface Brand {
  id: BrandId;
  name: string;
  shortName: string;
  /** Lower-case wordmark in the header. */
  wordmark: string;
  /** "skin" or "hair": what product-suitability questions Aria cannot answer. */
  concern: string;
  overview: string;
  policy: BrandPolicy;
  orders: Order[];
  /** Prefix of care-team references, e.g. AUR-4821. */
  referencePrefix: string;
  /** Aria's greeting in each call language (brand names inflect, so these are whole sentences). */
  greetings: Record<string, string>;
}

export const BRANDS: Record<BrandId, Brand> = {
  aura: {
    id: "aura",
    name: "Aura Skincare",
    shortName: "Aura",
    wordmark: "aura",
    concern: "skin",
    // From the brief, word for word.
    overview: "Aura Skincare is a premium organic Indian skincare brand focused on simple, effective skincare products made with thoughtfully selected ingredients.",
    policy: { returnDays: 7, damageHours: 48, codLimit: 2500, freeShippingAbove: 499, shippingFee: 50, deliveryDays: [3, 5] },
    orders: auraOrders,
    referencePrefix: "AUR",
    greetings: {
      "en-IN": "Hi, I'm Aria, your AI care specialist at Aura Skincare. How can I help you today?",
      "hi-IN": "नमस्ते, मैं आरिया हूँ, ऑरा स्किनकेयर की एआई सहायक। मैं आपकी कैसे मदद कर सकती हूँ?",
      "ta-IN": "வணக்கம், நான் ஆரியா, ஆரா ஸ்கின்கேரின் உதவியாளர். நான் உங்களுக்கு எப்படி உதவலாம்?",
      "te-IN": "నమస్తే, నేను ఆరియా, ఆరా స్కిన్‌కేర్ సహాయకురాలిని. నేను మీకు ఎలా సహాయం చేయగలను?",
      "bn-IN": "নমস্কার, আমি আরিয়া, আউরা স্কিনকেয়ারের সহকারী। আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
      "mr-IN": "नमस्कार, मी आरिया, ऑरा स्किनकेअरची सहायक. मी तुमची कशी मदत करू शकते?",
      "gu-IN": "નમસ્તે, હું આરિયા છું, ઓરા સ્કિનકેરની સહાયક. હું તમારી કેવી રીતે મદદ કરી શકું?",
      "kn-IN": "ನಮಸ್ಕಾರ, ನಾನು ಆರಿಯಾ, ಆರಾ ಸ್ಕಿನ್‌ಕೇರ್ ಸಹಾಯಕಿ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?",
      "ml-IN": "നമസ്കാരം, ഞാൻ ആരിയ, ഓറ സ്കിൻകെയറിന്റെ സഹായി. ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?",
      "pa-IN": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ ਆਰੀਆ ਹਾਂ, ਔਰਾ ਸਕਿਨਕੇਅਰ ਦੀ ਸਹਾਇਕ। ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦੀ ਹਾਂ?",
    },
  },
  veda: {
    id: "veda",
    name: "Veda Haircare",
    shortName: "Veda",
    wordmark: "veda",
    concern: "hair",
    overview: "Veda Haircare is an Ayurvedic Indian haircare brand making oils, shampoos and scalp treatments from traditional herbs such as bhringraj, amla and neem.",
    policy: { returnDays: 10, damageHours: 72, codLimit: 5000, freeShippingAbove: 799, shippingFee: 79, deliveryDays: [4, 6] },
    orders: vedaOrders,
    referencePrefix: "VED",
    greetings: {
      "en-IN": "Hi, I'm Aria, your AI care specialist at Veda Haircare. How can I help you today?",
      "hi-IN": "नमस्ते, मैं आरिया हूँ, वेदा हेयरकेयर की एआई सहायक। मैं आपकी कैसे मदद कर सकती हूँ?",
      "ta-IN": "வணக்கம், நான் ஆரியா, வேதா ஹேர்கேரின் உதவியாளர். நான் உங்களுக்கு எப்படி உதவலாம்?",
      "te-IN": "నమస్తే, నేను ఆరియా, వేదా హెయిర్‌కేర్ సహాయకురాలిని. నేను మీకు ఎలా సహాయం చేయగలను?",
      "bn-IN": "নমস্কার, আমি আরিয়া, বেদা হেয়ারকেয়ারের সহকারী। আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
      "mr-IN": "नमस्कार, मी आरिया, वेदा हेअरकेअरची सहायक. मी तुमची कशी मदत करू शकते?",
      "gu-IN": "નમસ્તે, હું આરિયા છું, વેદા હેરકેરની સહાયક. હું તમારી કેવી રીતે મદદ કરી શકું?",
      "kn-IN": "ನಮಸ್ಕಾರ, ನಾನು ಆರಿಯಾ, ವೇದಾ ಹೇರ್‌ಕೇರ್ ಸಹಾಯಕಿ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?",
      "ml-IN": "നമസ്കാരം, ഞാൻ ആരിയ, വേദ ഹെയർകെയറിന്റെ സഹായി. ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?",
      "pa-IN": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ ਆਰੀਆ ਹਾਂ, ਵੇਦਾ ਹੇਅਰਕੇਅਰ ਦੀ ਸਹਾਇਕ। ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦੀ ਹਾਂ?",
    },
  },
};

export const DEFAULT_BRAND: BrandId = "aura";
export const BRAND_IDS = Object.keys(BRANDS) as BrandId[];
export const isBrandId = (id: unknown): id is BrandId => typeof id === "string" && id in BRANDS;
export const brandById = (id?: string | null): Brand => BRANDS[isBrandId(id) ? id : DEFAULT_BRAND];

/** One order per scenario, so suggestions always point at IDs this brand really has. */
export function sampleIds(brand: Brand) {
  const first = (status: Order["status"]) => brand.orders.find(o => o.status === status)?.order_id ?? brand.orders[0].order_id;
  return { track: first("Out for Delivery"), returnable: first("Delivered"), cancellable: first("Processing") };
}

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const spoken = (value: number) => `${value.toLocaleString("en-IN")} rupees`;

/** The policy cards shown on the page. */
export function policyCards(brand: Brand) {
  const p = brand.policy;
  return [
    { id: "shipping", title: "Shipping", text: `Free delivery above ${inr(p.freeShippingAbove)}. Below ${inr(p.freeShippingAbove)}, a ${inr(p.shippingFee)} shipping fee. Standard delivery in ${p.deliveryDays[0]}–${p.deliveryDays[1]} business days.` },
    { id: "returns", title: "Returns & refunds", text: `Within ${p.returnDays} days of delivery, for unopened, unused products in original packaging.` },
    { id: "damage", title: "Damaged or defective", text: `Report within ${p.damageHours} hours of delivery, with photos, for a replacement.` },
    { id: "cancellation", title: "Cancellation", text: "Only while an order is Processing. Shipped or Out for Delivery orders can be refused at the doorstep." },
    { id: "cod", title: "Cash on Delivery", text: `Available up to ${inr(p.codLimit)}. Pay by cash or UPI at the doorstep.` },
  ];
}

/** Everything the model may state about the brand; it is told to use nothing else. */
export function brandKnowledge(brand: Brand): string {
  const p = brand.policy;
  return `Brand: ${brand.overview}
Shipping: free delivery on orders above ${spoken(p.freeShippingAbove)}; orders below ${spoken(p.freeShippingAbove)} pay a ${spoken(p.shippingFee).replace("rupees", "rupee")} shipping fee. The policy does not say what happens at exactly ${spoken(p.freeShippingAbove)}, so say that honestly instead of guessing. Standard delivery takes ${p.deliveryDays[0]} to ${p.deliveryDays[1]} business days.
Returns and refunds: accepted within ${p.returnDays} days of delivery, only for products that are unopened AND unused AND in their original packaging. Otherwise the return is declined; there are no exceptions, discounts or goodwill refunds.
Damaged or defective products: must be reported within ${p.damageHours} hours of delivery, with photos, for a replacement. You cannot receive photos or book the replacement yourself.
Cancellation: only while the order status is Processing. Shipped or Out for Delivery orders cannot be cancelled, but the customer may refuse delivery at the doorstep. Delivered orders cannot be cancelled.
Cash on Delivery: available for orders up to ${spoken(p.codLimit)} (inclusive); pay by cash or UPI at the doorstep.
Products: you only know the product names that appear in orders. You have no ingredient lists, prices for other products, stock levels, offers or ${brand.concern}-suitability data.`;
}
