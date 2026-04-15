import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  Category,
  CashPreview,
  DashboardStats,
  KitchenTicketPreview,
  Order,
  OrderHistoryRecord,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Product,
  RestaurantTable,
  TableStatus,
  UserRole,
} from '../types';

const SalaPage = lazy(() => import('../pages/SalaPage.responsive').then((module) => ({ default: module.SalaPage })));
const KitchenPage = lazy(() =>
  import('../pages/KitchenPage').then((module) => ({ default: module.KitchenPage })),
);
const CashPage = lazy(() => import('../pages/CashPage').then((module) => ({ default: module.CashPage })));
const HistoryPage = lazy(() =>
  import('../pages/HistoryPage').then((module) => ({ default: module.HistoryPage })),
);
const MenuPage = lazy(() => import('../pages/MenuPage').then((module) => ({ default: module.MenuPage })));
const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);

interface Props {
  sessionRole: UserRole;
  userId: string;
  tables: RestaurantTable[];
  selectedTable: RestaurantTable | null;
  products: Product[];
  tableDrafts: Record<string, OrderItem[]>;
  menuProducts: Product[];
  categories: Category[];
  orders: Order[];
  historyOrders: OrderHistoryRecord[];
  historyLoading: boolean;
  stats: DashboardStats | null;
  dashboardFilters: {
    from?: string;
    to?: string;
  };
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
  onSetStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  onCloseTable: (tableId: string, method: PaymentMethod) => Promise<void>;
  onPreviewTable: (tableId: string) => Promise<CashPreview>;
  onPrintInvoice: (tableId: string) => Promise<void>;
  onHistorySearch: (filters: {
    from?: string;
    to?: string;
    tableId?: string;
    status?: OrderStatus | '';
    paymentGroup?: 'COP' | 'BS' | 'USD' | 'ZELLE' | 'CARD' | '';
  }) => Promise<void>;
  onReprintKitchen: (orderId: string) => Promise<KitchenTicketPreview | null>;
  onPrintOrderReceipt: (orderId: string) => Promise<void>;
  onCreateProduct: (payload: { name: string; price: number; categoryId?: string }) => Promise<void>;
  onUpdateProduct: (
    id: string,
    payload: { name: string; price: number; categoryId?: string },
  ) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onSetProductStatus: (id: string, isActive: boolean) => Promise<void>;
  onCreateCategory: (name: string, isPackaging?: boolean) => Promise<void>;
  onUpdateCategory: (
    id: string,
    payload: { name?: string; isPackaging?: boolean },
  ) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onLoadStats: (filters: { from?: string; to?: string }) => Promise<void>;
  onSaveExchangeRates: (payload: {
    copToBsDivisor: number;
    copToUsdDivisor: number;
  }) => Promise<void>;
}

export function AppRoutes(props: Props) {
  return (
    <Suspense fallback={<section className="panel">Cargando vista...</section>}>
      <Routes>
        <Route path="/" element={<Navigate to="/sala" replace />} />
        <Route
          path="/sala"
          element={
            <SalaPage
              sessionRole={props.sessionRole}
              tables={props.tables}
              selectedTable={props.selectedTable}
              products={props.products}
              tableDrafts={props.tableDrafts}
              setSelectedTable={props.setSelectedTable}
              onUpdateLayout={props.onUpdateLayout}
              onMoveTable={props.onMoveTable}
              onChangeItems={props.onChangeItems}
              onCreateOrder={props.onCreateOrder}
              onPrintKitchenTicket={props.onPrintKitchenTicket}
              onCreateTable={props.onCreateTable}
              onRenameTable={props.onRenameTable}
              onChangeStatus={props.onChangeStatus}
              onDeleteTable={props.onDeleteTable}
            />
          }
        />
        <Route path="/kds" element={<KitchenPage orders={props.orders} onSetStatus={props.onSetStatus} />} />
        <Route
          path="/caja"
          element={
            <CashPage
              userId={props.userId}
              tables={props.tables}
              onCloseTable={props.onCloseTable}
              onPreviewTable={props.onPreviewTable}
              onPrintInvoice={props.onPrintInvoice}
            />
          }
        />
        <Route
          path="/historial"
          element={
            <HistoryPage
              tables={props.tables}
              orders={props.historyOrders}
              loading={props.historyLoading}
              exchangeRates={props.stats?.exchangeRates}
              onSearch={props.onHistorySearch}
              onReprint={props.onReprintKitchen}
              onPrintKitchenTicket={props.onPrintKitchenTicket}
              onPrintOrderReceipt={props.onPrintOrderReceipt}
            />
          }
        />
        <Route
          path="/menu"
          element={
            props.sessionRole === 'ADMIN' ? (
              <MenuPage
                products={props.menuProducts}
                categories={props.categories}
                onCreateProduct={props.onCreateProduct}
                onUpdateProduct={props.onUpdateProduct}
                onDeleteProduct={props.onDeleteProduct}
                onSetProductStatus={props.onSetProductStatus}
                onCreateCategory={props.onCreateCategory}
                onUpdateCategory={props.onUpdateCategory}
                onDeleteCategory={props.onDeleteCategory}
              />
            ) : (
              <Navigate to="/sala" replace />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            <DashboardPage
              stats={props.stats}
              filters={props.dashboardFilters}
              onLoadStats={props.onLoadStats}
              onSaveExchangeRates={props.onSaveExchangeRates}
            />
          }
        />
        <Route path="*" element={<Navigate to="/sala" replace />} />
      </Routes>
    </Suspense>
  );
}
