import { CashPanel } from "../components/CashPanel";
import {
  CashChangeQuote,
  CashPreview,
  CashSessionSummary,
  PaymentCurrency,
  PaymentMethod,
  RestaurantTable,
} from "../types";

interface Props {
  userId: string;
  tables: RestaurantTable[];
  onCloseTable: (payload: {
    tableId: string;
    method: PaymentMethod;
    tenderedCurrency?: PaymentCurrency;
    tenderedAmount?: number;
    changeCurrency?: PaymentCurrency;
    registerInCashSession?: boolean;
    note?: string;
    orderIds?: string[];
  }) => Promise<void>;
  onPreviewTable: (tableId: string) => Promise<CashPreview>;
  onPrintInvoice: (tableId: string) => Promise<void>;
  onLoadActiveCashSession: () => Promise<CashSessionSummary | null>;
  onOpenCashSession: (payload: {
    openingCop: number;
    openingBs: number;
    openingUsd: number;
    openingNote?: string;
  }) => Promise<CashSessionSummary>;
  onCloseCashSession: (payload: {
    sessionId: string;
    countedCop?: number;
    countedBs?: number;
    countedUsd?: number;
    closingNote?: string;
  }) => Promise<void>;
  onCalculateCashChange: (payload: {
    totalAmount: number;
    totalCurrency: PaymentCurrency;
    tenderedAmount: number;
    tenderedCurrency: PaymentCurrency;
    changeCurrency?: PaymentCurrency;
  }) => Promise<CashChangeQuote>;
  onCreateCashMovement: (payload: {
    sessionId: string;
    type: 'EXPENSE' | 'MANUAL_INCOME' | 'EXCHANGE_IN' | 'EXCHANGE_OUT' | 'CLOSING_ADJUSTMENT';
    currency: PaymentCurrency;
    amount: number;
    note?: string;
    tableId?: string;
    relatedCurrency?: PaymentCurrency;
    relatedAmount?: number;
    paymentMethod?: PaymentMethod;
  }) => Promise<void>;
}

export function CashPage({
  userId,
  tables,
  onCloseTable,
  onPreviewTable,
  onPrintInvoice,
  onLoadActiveCashSession,
  onOpenCashSession,
  onCloseCashSession,
  onCalculateCashChange,
  onCreateCashMovement,
}: Props) {
   return (
    <CashPanel
      userId={userId}
      tables={tables}
      onCloseTable={onCloseTable}
      onPreviewTable={onPreviewTable}
      onPrintInvoice={onPrintInvoice}
      onLoadActiveCashSession={onLoadActiveCashSession}
      onOpenCashSession={onOpenCashSession}
      onCloseCashSession={onCloseCashSession}
      onCalculateCashChange={onCalculateCashChange}
      onCreateCashMovement={onCreateCashMovement}
    />
  );
}
