import type { OrderStatus, PaymentStatus, FulfillmentStatus, DeliveryStatus, OrderDocumentType } from "@prisma/client";

export type OrderListQuery = {
  search?: string;
  query?: string;
  queuePreset?: string;
  queue?: string;
  status?: OrderStatus | "";
  paymentStatus?: PaymentStatus | "";
  fulfillmentStatus?: FulfillmentStatus | "";
  deliveryStatus?: DeliveryStatus | "";
  managerId?: string;
  country?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "newest" | "oldest" | "total";
};

export type OrderItemDto = {
  id: string;
  orderId: string;
  productId: string | null;
  requestedPartNumber: string | null;
  nameOnPurchase: string;
  quantity: number;
  condition: string | null;
  supplierOfferId: string | null;
  supplierId: string | null;
  supplierName?: string;
  supplierCountry?: string;
  purchasePrice?: string; // Hidden if !canReadPurchase
  purchaseCurrency?: string;
  fxRate?: string;
  supplierLogisticsCost?: string;
  markup?: string; // Hidden if !canReadPurchase
  salePrice: string;
  totalAmount: string;
  grossProfit?: string; // Hidden if !canReadPurchase
  marginPercent?: string; // Hidden if !canReadPurchase
  financialSnapshot?: any;
};

export type PaymentDto = {
  id: string;
  orderId: string;
  amount: string;
  currency: string;
  paymentMethod: string;
  status: PaymentStatus;
  externalPaymentId: string | null;
  paidAt: string | null;
  notes: string | null;
  history?: any;
  createdAt: string;
};

export type ShipmentDto = {
  id: string;
  orderId: string;
  carrier: string;
  tariff: string | null;
  deliveryMethod: string;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  pickupPointId: string | null;
  trackingNumber: string | null;
  cost: string;
  estimatedDays: number | null;
  status: DeliveryStatus;
  trackingHistory?: any;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

export type OrderDocumentDto = {
  id: string;
  orderId: string;
  documentType: OrderDocumentType;
  documentNumber: string;
  fileUrl: string | null;
  contentJson?: any;
  version: number;
  createdAt: string;
};

export type OrderMessageDto = {
  id: string;
  orderId: string;
  senderType: "STAFF" | "CUSTOMER";
  isInternal: boolean;
  message: string;
  attachments?: any;
  authorName: string;
  createdAt: string;
};

export type OrderDto = {
  id: string;
  orderNumber: string;
  requestId: string | null;
  requestNumber?: string | null;
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  assignedManagerId: string | null;
  assignedManagerName?: string | null;
  source: string;
  country: string;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  deliveryStatus: DeliveryStatus;
  subtotal: string;
  logisticsTotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  customerComment: string | null;
  internalComment: string | null; // Hidden for LOGISTICS
  rejectionReason: string | null;
  logisticsInstructions: string | null;
  financialSnapshot?: any; // Hidden if !canReadPurchase
  items: OrderItemDto[];
  payments: PaymentDto[];
  shipments: ShipmentDto[];
  documents: OrderDocumentDto[];
  messages: OrderMessageDto[];
  events?: Array<{ at: string; text: string; who: string }>;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
};
