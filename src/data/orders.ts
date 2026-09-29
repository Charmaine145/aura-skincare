import type { Order } from "@/types";
export const orders: Order[] = [
  { order_id: "ORD-101", customer_name: "Priya Sharma", product: "Vitamin C Serum (30ml)", value: 699, status: "Out for Delivery", delivery_partner: "BlueDart", tracking_id: "BD-982103", delivery_notes: "Expected by 6 PM today" },
  { order_id: "ORD-102", customer_name: "Rahul Verma", product: "Hydrating Sunscreen SPF 50", value: 499, status: "Delivered", delivery_partner: "Delhivery", tracking_id: "DL-441029", delivery_notes: "Delivered 14 days ago", delivered_days_ago: 14 },
  { order_id: "ORD-103", customer_name: "Ananya Patel", product: "Green Tea Face Wash + Toner", value: 850, status: "Processing", delivery_notes: "Ordered 3 hours ago. Eligible for cancellation" },
];
