import { useEffect, useMemo, useState } from 'react';
import { api, flushOfflineQueue } from './api';
import { AdminMenuPanel } from './components/AdminMenuPanel';
import { AdminTablesPanel } from './components/AdminTablesPanel';
import { CashPanel } from './components/CashPanel';
import { DashboardCards } from './components/DashboardCards';
import { KitchenBoard } from './components/KitchenBoard';
import { LoginForm } from './components/LoginForm';
import { OrderHistoryPanel } from './components/OrderHistoryPanel';
import { OrderPanel } from './components/OrderPanel';
import { TableGrid } from './components/TableGrid';
import { clearSession, loadSession, saveSession } from './store/auth';
import { loadOrderDrafts, saveOrderDrafts } from './store/orderDrafts';
import { connectSocket, getSocket } from './store/socket';
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
  UserSession,
} from './types';

function App() {
  const dateToInput = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;

  const getTodayRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const value = dateToInput(today);
    return { from: value, to: value };
  };

  const [session, setSession] = useState<UserSession | null>(loadSession());
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [menuProducts, setMenuProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<OrderHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tableDrafts, setTableDrafts] = useState<Record<string, OrderItem[]>>({});
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dashboardFilters, setDashboardFilters] = useState<{ from?: string; to?: string }>(
    getTodayRange,
  );
  const [tab, setTab] = useState<'sala' | 'kds' | 'caja' | 'menu' | 'dashboard' | 'historial'>('sala');
  const [draftsHydrated, setDraftsHydrated] = useState(false);

  const token = session?.accessToken;

  const loadData = async () => {
    if (!token) {
      return;
    }

    const [tablesResult, productsResult, categoriesResult, ordersResult] = await Promise.allSettled([
      api<RestaurantTable[]>('/tables', 'GET', token),
      api<Product[]>('/products', 'GET', token),
      api<Category[]>('/products/categories', 'GET', token),
      api<Order[]>('/orders/active', 'GET', token),
    ]);

    if (tablesResult.status === 'fulfilled') {
      setTables(tablesResult.value);
    }

    if (productsResult.status === 'fulfilled') {
      setProducts(productsResult.value);
      if (session?.role !== 'ADMIN') {
        setMenuProducts(productsResult.value);
      }
    }

    if (session?.role === 'ADMIN') {
      const adminProductsResult = await Promise.allSettled([
        api<Product[]>('/products/admin', 'GET', token),
      ]);

      if (adminProductsResult[0].status === 'fulfilled') {
        setMenuProducts(adminProductsResult[0].value);
      }
    }

    if (categoriesResult.status === 'fulfilled') {
      setCategories(categoriesResult.value);
    }

    if (ordersResult.status === 'fulfilled') {
      setOrders(ordersResult.value);
    }

    if (session?.role === 'ADMIN') {
      try {
        const params = new URLSearchParams();
        if (dashboardFilters.from) params.set('from', dashboardFilters.from);
        if (dashboardFilters.to) params.set('to', dashboardFilters.to);
        const query = params.toString();
        const path = query ? `/dashboard/stats?${query}` : '/dashboard/stats';
        const s = await api<typeof stats>(path, 'GET', token);
        setStats(s);
      } catch {
        setStats(null);
      }
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    loadData();
    flushOfflineQueue(token).then(loadData).catch(() => undefined);

    const socket = connectSocket();
    const refresh = () => loadData();

    socket.on('order.created', refresh);
    socket.on('order.status.changed', refresh);
    socket.on('table.status.changed', refresh);
    socket.on('cash.closed', refresh);

    return () => {
      socket.off('order.created', refresh);
      socket.off('order.status.changed', refresh);
      socket.off('table.status.changed', refresh);
      socket.off('cash.closed', refresh);
      getSocket()?.disconnect();
    };
  }, [token, dashboardFilters.from, dashboardFilters.to]);

  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      setSession(null);
    };

    window.addEventListener('lacasona:unauthorized', onUnauthorized);
    return () => window.removeEventListener('lacasona:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    if (!session?.id) {
      setTableDrafts({});
      setDraftsHydrated(false);
      return;
    }

    setTableDrafts(loadOrderDrafts(session.id));
    setDraftsHydrated(true);
  }, [session?.id]);

  useEffect(() => {
    if (!session?.id || !draftsHydrated) {
      return;
    }

    saveOrderDrafts(session.id, tableDrafts);
  }, [session?.id, tableDrafts, draftsHydrated]);

  const roleTitle = useMemo(() => session?.role || 'guest', [session]);

  const handleLogin = async (email: string, password: string) => {
    const res = await api<{ accessToken: string; user: Omit<UserSession, 'accessToken'> }>(
      '/auth/login',
      'POST',
      undefined,
      { email, password },
    );

    const nextSession: UserSession = { ...res.user, accessToken: res.accessToken };
    saveSession(nextSession);
    setSession(nextSession);
  };

  const createOrder = async (
    tableId: string,
    items: OrderItem[],
  ): Promise<KitchenTicketPreview | null> => {
    if (!token || !session) {
      return null;
    }
    const order = await api<Order>('/orders', 'POST', token, {
      tableId,
      waiterId: session.id,
      items,
    });

    let preview: KitchenTicketPreview | null = null;
    try {
      preview = await api<KitchenTicketPreview>(
        `/printing/kitchen-ticket/${order.id}`,
        'GET',
        token,
      );
    } catch {
      preview = null;
    }

    setTableDrafts((current) => ({ ...current, [tableId]: [] }));
    await loadData();
    return preview;
  };

  const setOrderStatus = async (orderId: string, status: OrderStatus) => {
    if (!token) {
      return;
    }
    await api(`/orders/${orderId}/status`, 'PATCH', token, { status });
    await loadData();
  };

  const closeTable = async (tableId: string, method: PaymentMethod) => {
    if (!token || !session) {
      return;
    }
    await api('/cash/close-table', 'POST', token, {
      tableId,
      cashierId: session.id,
      method,
    });
    await loadData();
  };

  const getCashPreview = async (tableId: string): Promise<CashPreview> => {
    if (!token) {
      throw new Error('No token');
    }

    return api<CashPreview>(`/cash/preview/${tableId}`, 'GET', token);
  };

  const updateExchangeRates = async (payload: {
    copToBsDivisor: number;
    copToUsdDivisor: number;
  }) => {
    if (!token) {
      return;
    }
    await api('/dashboard/exchange-rates', 'PATCH', token, payload);
    await loadData();
  };

  const loadDashboardStats = async (filters?: { from?: string; to?: string }) => {
    if (!token || session?.role !== 'ADMIN') {
      return;
    }

    const nextFilters = {
      from: filters?.from,
      to: filters?.to,
    };
    setDashboardFilters(nextFilters);

    const params = new URLSearchParams();
    if (nextFilters.from) params.set('from', nextFilters.from);
    if (nextFilters.to) params.set('to', nextFilters.to);
    const query = params.toString();
    const path = query ? `/dashboard/stats?${query}` : '/dashboard/stats';

    const nextStats = await api<DashboardStats>(path, 'GET', token);
    setStats(nextStats);
  };

  const createTable = async (name: string, capacity: number, zone?: string) => {
    if (!token) {
      return;
    }
    await api('/tables', 'POST', token, { name, capacity, zone });
    await loadData();
  };

  const changeTableStatus = async (tableId: string, status: TableStatus) => {
    if (!token) {
      return;
    }
    await api(`/tables/${tableId}/status`, 'PATCH', token, { status });
    await loadData();
  };

  const renameTable = async (tableId: string, name: string) => {
    if (!token) {
      return;
    }
    await api(`/tables/${tableId}`, 'PATCH', token, { name });
    setSelectedTable((current) =>
      current?.id === tableId ? { ...current, name } : current,
    );
    await loadData();
  };

  const updateTableLayout = async (
    tableId: string,
    payload: { zone?: string; layoutX?: number; layoutY?: number },
  ) => {
    if (!token) {
      return;
    }
    await api(`/tables/${tableId}`, 'PATCH', token, payload);
    await loadData();
  };

  const deleteTable = async (tableId: string) => {
    if (!token) {
      return;
    }
    try {
      await api(`/tables/${tableId}`, 'DELETE', token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo deshabilitar la mesa';
      window.alert(message);
      return;
    }
    setSelectedTable((current) => (current?.id === tableId ? null : current));
    setTableDrafts((current) => {
      const next = { ...current };
      delete next[tableId];
      return next;
    });
    await loadData();
  };

  const swapTables = async (fromTableId: string, toTableId: string) => {
    if (!token) {
      return;
    }

    const parseErrorMessage = (error: unknown) => {
      if (!(error instanceof Error)) {
        return '';
      }

      try {
        const parsed = JSON.parse(error.message) as { message?: string | string[] };
        if (Array.isArray(parsed.message)) {
          return parsed.message.join(' | ');
        }
        return parsed.message || error.message;
      } catch {
        return error.message;
      }
    };

    try {
      await api('/orders/swap-tables', 'POST', token, { fromTableId, toTableId });
      setSelectedTable(null);
      await loadData();
    } catch (error) {
      const message = parseErrorMessage(error);
      const hasOnlyDraft = message.includes('No active orders to swap');

      if (!hasOnlyDraft) {
        window.alert(message || 'No se pudo mover la mesa');
        return;
      }

      const fromDraft = tableDrafts[fromTableId] || [];
      const toDraft = tableDrafts[toTableId] || [];

      if (!fromDraft.length) {
        window.alert('No hay comanda activa ni borrador para mover en la mesa origen.');
        return;
      }

      if (toDraft.length) {
        window.alert('La mesa destino ya tiene un borrador local. Limpialo antes de mover.');
        return;
      }

      setTableDrafts((current) => ({
        ...current,
        [fromTableId]: [],
        [toTableId]: fromDraft,
      }));

      setSelectedTable((current) => {
        if (!current) {
          return current;
        }
        if (current.id === fromTableId) {
          const destinationTable = tables.find((table) => table.id === toTableId);
          return destinationTable || current;
        }
        return current;
      });

      setTables((current) =>
        current.map((table) => {
          if (table.id === fromTableId) {
            return { ...table, status: 'FREE' };
          }
          if (table.id === toTableId) {
            return { ...table, status: 'OCCUPIED' };
          }
          return table;
        }),
      );

      try {
        await Promise.all([
          api(`/tables/${fromTableId}/status`, 'PATCH', token, { status: 'FREE' }),
          api(`/tables/${toTableId}/status`, 'PATCH', token, { status: 'OCCUPIED' }),
        ]);
      } catch {
        await loadData();
      }
    }
  };

  const createProduct = async (payload: { name: string; price: number; categoryId?: string }) => {
    if (!token) {
      return;
    }
    await api('/products', 'POST', token, payload);
    await loadData();
  };

  const updateProduct = async (
    id: string,
    payload: { name: string; price: number; categoryId?: string },
  ) => {
    if (!token) {
      return;
    }
    await api(`/products/${id}`, 'PATCH', token, payload);
    await loadData();
  };

  const deleteProduct = async (id: string) => {
    if (!token) {
      return;
    }
    await api(`/products/${id}`, 'DELETE', token);
    await loadData();
  };

  const setProductStatus = async (id: string, isActive: boolean) => {
    if (!token) {
      return;
    }
    await api(`/products/${id}/status`, 'PATCH', token, { isActive });
    await loadData();
  };

  const createCategory = async (name: string, isPackaging?: boolean) => {
    if (!token) {
      return;
    }
    await api('/products/categories', 'POST', token, { name, isPackaging: Boolean(isPackaging) });
    await loadData();
  };

  const updateCategory = async (
    id: string,
    payload: { name?: string; isPackaging?: boolean },
  ) => {
    if (!token) {
      return;
    }
    await api(`/products/categories/${id}`, 'PATCH', token, payload);
    await loadData();
  };

  const deleteCategory = async (id: string) => {
    if (!token) {
      return;
    }
    await api(`/products/categories/${id}`, 'DELETE', token);
    await loadData();
  };

  const ensureTableOccupied = async (tableId: string) => {
    if (!token) {
      return;
    }

    setTables((current) =>
      current.map((table) =>
        table.id === tableId && table.status === 'FREE'
          ? { ...table, status: 'OCCUPIED' }
          : table,
      ),
    );

    try {
      await api(`/tables/${tableId}/status`, 'PATCH', token, { status: 'OCCUPIED' });
    } catch {
      await loadData();
    }
  };

  const loadOrderHistory = async (filters?: {
    from?: string;
    to?: string;
    tableId?: string;
    status?: OrderStatus | '';
    paymentGroup?: 'COP' | 'BS' | 'USD' | 'ZELLE' | 'CARD' | '';
  }) => {
    if (!token) {
      return;
    }

    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (filters?.from) params.set('from', filters.from);
      if (filters?.to) params.set('to', filters.to);
      if (filters?.tableId) params.set('tableId', filters.tableId);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.paymentGroup) params.set('paymentGroup', filters.paymentGroup);

      const query = params.toString();
      const path = query ? `/orders/history?${query}` : '/orders/history';
      const result = await api<OrderHistoryRecord[]>(path, 'GET', token);
      setHistoryOrders(result);
    } finally {
      setHistoryLoading(false);
    }
  };

  const reprintKitchenTicket = async (orderId: string): Promise<KitchenTicketPreview | null> => {
    if (!token) {
      return null;
    }

    try {
      return await api<KitchenTicketPreview>(`/printing/kitchen-ticket/${orderId}`, 'GET', token);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (tab === 'historial') {
      void loadOrderHistory();
    }
  }, [tab]);

  if (!session) {
    return (
      <main className="app shell">
        <LoginForm onSubmit={handleLogin} />
      </main>
    );
  }

  return (
    <main className="app">
      <header className="topbar">
        <h1>La Casona POS</h1>
        <p>Rol actual: {roleTitle}</p>
        <button
          onClick={() => {
            clearSession();
            setSession(null);
          }}
        >
          Salir
        </button>
      </header>

      <nav className="tabs">
        <button onClick={() => setTab('sala')}>Sala</button>
        <button onClick={() => setTab('kds')}>Cocina</button>
        <button onClick={() => setTab('caja')}>Caja</button>
        <button onClick={() => setTab('historial')}>Historial</button>
        {session.role === 'ADMIN' && <button onClick={() => setTab('menu')}>Menu</button>}
        <button onClick={() => setTab('dashboard')}>Reportes</button>
      </nav>

      {tab === 'sala' && (
        <>
          <section className="layout-two">
            <TableGrid
              tables={tables}
              onSelect={setSelectedTable}
              canEditLayout={session.role === 'ADMIN'}
              onUpdateLayout={updateTableLayout}
            />
            <OrderPanel
              table={selectedTable}
              tables={tables}
              products={products}
              items={selectedTable ? tableDrafts[selectedTable.id] || [] : []}
              canMoveTable={session.role === 'ADMIN' || session.role === 'WAITER'}
              onMoveTable={swapTables}
              onChangeItems={(items) => {
                if (!selectedTable) {
                  return;
                }

                const previousItems = tableDrafts[selectedTable.id] || [];
                const switchedToDraftWithItems = previousItems.length === 0 && items.length > 0;
                const tableState = tables.find((table) => table.id === selectedTable.id);

                if (switchedToDraftWithItems && tableState?.status === 'FREE') {
                  void ensureTableOccupied(selectedTable.id);
                }

                setTableDrafts((current) => ({
                  ...current,
                  [selectedTable.id]: items,
                }));
              }}
              onCreateOrder={createOrder}
            />
          </section>
          {session.role === 'ADMIN' && (
            <>
              <AdminTablesPanel
                tables={tables}
                onCreateTable={createTable}
                onRenameTable={renameTable}
                onUpdateLayout={updateTableLayout}
                onChangeStatus={changeTableStatus}
                onDeleteTable={deleteTable}
              />
            </>
          )}
        </>
      )}

      {tab === 'kds' && <KitchenBoard orders={orders} onSetStatus={setOrderStatus} />}
      {tab === 'caja' && (
        <CashPanel
          userId={session.id}
          tables={tables}
          onCloseTable={closeTable}
          onPreviewTable={getCashPreview}
        />
      )}
      {tab === 'historial' && (
        <OrderHistoryPanel
          tables={tables}
          orders={historyOrders}
          loading={historyLoading}
          exchangeRates={stats?.exchangeRates}
          onSearch={loadOrderHistory}
          onReprint={reprintKitchenTicket}
        />
      )}
      {tab === 'menu' && session.role === 'ADMIN' && (
        <AdminMenuPanel
          products={menuProducts}
          categories={categories}
          onCreateProduct={createProduct}
          onUpdateProduct={updateProduct}
          onDeleteProduct={deleteProduct}
          onSetProductStatus={setProductStatus}
          onCreateCategory={createCategory}
          onUpdateCategory={updateCategory}
          onDeleteCategory={deleteCategory}
        />
      )}
      {tab === 'dashboard' && (
        <DashboardCards
          stats={stats}
          filters={dashboardFilters}
          onLoadStats={loadDashboardStats}
          onSaveExchangeRates={updateExchangeRates}
        />
      )}
    </main>
  );
}

export default App;
