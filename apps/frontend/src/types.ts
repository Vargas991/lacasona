export type UserRole = 'ADMIN' | 'WAITER' | 'KITCHEN';

export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'BILLING' | 'DISABLED';

export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED';

export type PaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'CASH_COP'
  | 'BOLIVARES'
  | 'POS'
  | 'MOBILE_PAYMENT'
  | 'USD'
  | 'ZELLE'
  | 'BANCOLOMBIA';

export type PaymentCurrency = 'COP' | 'BS' | 'USD';

export type CashSessionStatus = 'OPEN' | 'CLOSED';

export type CashMovementType =
  | 'OPENING'
  | 'SALE_TENDERED'
  | 'CHANGE_GIVEN'
  | 'MANUAL_INCOME'
  | 'EXPENSE'
  | 'EXCHANGE_IN'
  | 'EXCHANGE_OUT'
  | 'CLOSING_ADJUSTMENT';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accessToken: string;
}

export interface RestaurantTable {
  id: string;
  name: string;
  capacity: number;
  zone?: string;
  layoutX?: number;
  layoutY?: number;
  status: TableStatus;
}

export interface Product {
  id: string;
  name: string;
  price: string;
  isActive?: boolean;
  description?: string;
  category?: {
    id: string;
    name: string;
    isPackaging?: boolean;
  } | null;
}

export interface Category {
  id: string;
  name: string;
  isPackaging?: boolean;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  note?: string;
}

export interface Order {
  id: string;
  tableId: string;
  waiterId: string;
  dateKey: string;
  dailySequence: number;
  status: OrderStatus;
  createdAt: string;
  table: RestaurantTable;
  items: Array<{
    id: string;
    quantity: number;
    note?: string;
    unitPrice: string;
    product: Product;
  }>;
  isDelivery?: boolean;
  deliveryAddress?: string;
}

export interface CashPreviewItem {
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  note?: string;
}

export interface CashPreview {
  table: {
    id: string;
    name: string;
  };
  orders: Array<{
    id: string;
    status: string;
    createdAt: string;
    isDelivery?: boolean;
    deliveryAddress?: string;
  }>;
  items: CashPreviewItem[];
  subtotal: number;
  tax: number;
  total: number;
  conversions: {
    cop: number;
    bs: number;
    usd: number;
  };
  exchangeRates: {
    copToBsDivisor: number;
    copToUsdDivisor: number;
  };
}

export interface KitchenTicketPreview {
  orderId: string;
  printable: boolean;
  isDelivery: boolean;
  deliveryAddress?: string;
  validationErrors: string[];
  previewText: string;
  escpos: string;
}

export interface PrintJobResult {
  success: boolean;
  message: string;
}

export interface InvoiceTicketPreview {
  table: string;
  total: number;
  escpos: string;
}

export interface OrderReceiptPreview {
  orderId: string;
  table: string;
  total: number;
  previewText: string;
  escpos: string;
}

export interface OrderHistoryRecord extends Order {
  waiter: {
    id: string;
    name: string;
    email: string;
  };
  payment?: {
    id: string;
    total: string;
    method: PaymentMethod;
    paidCurrency?: 'COP' | 'BS' | 'USD';
    paidAmount?: string;
    copToBsDivisorSnapshot?: string;
    copToUsdDivisorSnapshot?: string;
    paidAt: string;
  } | null;
  isDelivery?: boolean;
  deliveryAddress?: string;
}

export interface DashboardStats {
  tablesFree: number;
  tablesOccupied: number;
  activeOrders: number;
  revenueToday: number;
  revenuePeriod?: number;
  ticketsToday: number;
  ticketsPeriod?: number;
  dateRange?: {
    from: string;
    to: string;
  };
  exchangeRates: {
    copToBsDivisor: number;
    copToUsdDivisor: number;
  };
  paymentsByMethod: Array<{
    method: PaymentMethod;
    count: number;
    total: number;
  }>;
  salesReport: Array<{
    productId: string;
    productName: string;
    categoryName: string;
    isPackaging: boolean;
    isBeverage: boolean;
    quantity: number;
    unitPrice: number;
    totalCop: number;
    totalBs: number;
    totalUsd: number;
  }>;
}

export interface CashMovementRecord {
  id: string;
  cashSessionId: string;
  createdById: string;
  tableId?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  type: CashMovementType;
  currency: PaymentCurrency;
  amount: number;
  paymentMethod?: PaymentMethod | null;
  relatedCurrency?: PaymentCurrency | null;
  relatedAmount?: number | null;
  note?: string | null;
  createdAt: string;
}

export interface CashSessionSummary {
  session: {
    id: string;
    cashierId: string;
    status: CashSessionStatus;
    openingCurrency: PaymentCurrency;
    openingAmount: number;
    openingNote?: string | null;
    openedAt: string;
    closedAt?: string | null;
    closingNote?: string | null;
  };
  expectedBalances: Record<PaymentCurrency, number>;
  countedBalances: Record<PaymentCurrency, number | null>;
  differences: Record<PaymentCurrency, number | null>;
  salesByCurrency: Record<PaymentCurrency, { count: number; total: number }>;
  movementTotals: {
    inflows: Record<PaymentCurrency, number>;
    outflows: Record<PaymentCurrency, number>;
    byType: Record<string, number>;
  };
  movements: CashMovementRecord[];
  paymentsCount: number;
}

export interface CashChangeQuote {
  total: {
    amount: number;
    currency: PaymentCurrency;
    copEquivalent: number;
  };
  tendered: {
    amount: number;
    currency: PaymentCurrency;
    copEquivalent: number;
  };
  change: {
    copEquivalent: number;
    dueInTenderedCurrency: {
      amount: number;
      currency: PaymentCurrency;
    };
    deliverInCurrency: {
      amount: number;
      currency: PaymentCurrency;
    };
  };
  exchangeRates: {
    copToBsDivisor: number;
    copToUsdDivisor: number;
  };
}
