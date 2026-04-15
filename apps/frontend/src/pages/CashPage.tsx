import { CashPanel } from "../components/CashPanel";
import {
  CashPreview,
  PaymentMethod,
  RestaurantTable,
} from "../types";

interface Props {
  userId: string;
  tables: RestaurantTable[];
  onCloseTable: (tableId: string, method: PaymentMethod) => Promise<void>;
  onPreviewTable: (tableId: string) => Promise<CashPreview>;
  onPrintInvoice: (tableId: string) => Promise<void>;
}

export function CashPage({
  userId,
  tables,
  onCloseTable,
  onPreviewTable,
  onPrintInvoice,
}: Props) {
   return (
    <CashPanel
      userId={userId}
      tables={tables}
      onCloseTable={onCloseTable}
      onPreviewTable={onPreviewTable}
      onPrintInvoice={onPrintInvoice}
    />
  );
}
