import { AdminTablesPanel } from '../components/AdminTablesPanel';
import { OrderPanel } from '../components/OrderPanel';
import { TableGrid } from '../components/TableGrid';
import { KitchenTicketPreview, OrderItem, Product, RestaurantTable, TableStatus } from '../types';

interface Props {
  sessionRole: 'ADMIN' | 'WAITER' | 'KITCHEN';
  tables: RestaurantTable[];
  selectedTable: RestaurantTable | null;
  products: Product[];
  tableDrafts: Record<string, OrderItem[]>;
  setSelectedTable: (table: RestaurantTable | null) => void;
  onUpdateLayout: (
    tableId: string,
    payload: { zone?: string; layoutX?: number; layoutY?: number },
  ) => Promise<void>;
  onMoveTable: (fromTableId: string, toTableId: string) => Promise<void>;
  onChangeItems: (items: OrderItem[]) => void;
  onCreateOrder: (tableId: string, items: OrderItem[]) => Promise<KitchenTicketPreview | null>;
  onPrintKitchenTicket: (orderId: string) => Promise<void>;
  onCreateTable: (name: string, capacity: number, zone?: string) => Promise<void>;
  onRenameTable: (tableId: string, name: string) => Promise<void>;
  onChangeStatus: (tableId: string, status: TableStatus) => Promise<void>;
  onDeleteTable: (tableId: string) => Promise<void>;
}

export function SalaPage({
  sessionRole,
  tables,
  selectedTable,
  products,
  tableDrafts,
  setSelectedTable,
  onUpdateLayout,
  onMoveTable,
  onChangeItems,
  onCreateOrder,
  onPrintKitchenTicket,
  onCreateTable,
  onRenameTable,
  onChangeStatus,
  onDeleteTable,
}: Props) {
  return (
    <>
      <section className="layout-two">
        <TableGrid
          tables={tables}
          onSelect={setSelectedTable}
          canEditLayout={sessionRole === 'ADMIN'}
          onUpdateLayout={onUpdateLayout}
        />
        <OrderPanel
          table={selectedTable}
          tables={tables}
          products={products}
          items={selectedTable ? tableDrafts[selectedTable.id] || [] : []}
          canMoveTable={sessionRole === 'ADMIN' || sessionRole === 'WAITER'}
          onMoveTable={onMoveTable}
          onChangeItems={onChangeItems}
          onCreateOrder={onCreateOrder}
          onPrintKitchenTicket={onPrintKitchenTicket}
        />
      </section>
      {sessionRole === 'ADMIN' && (
        <AdminTablesPanel
          tables={tables}
          onCreateTable={onCreateTable}
          onRenameTable={onRenameTable}
          onUpdateLayout={onUpdateLayout}
          onChangeStatus={onChangeStatus}
          onDeleteTable={onDeleteTable}
        />
      )}
    </>
  );
}
