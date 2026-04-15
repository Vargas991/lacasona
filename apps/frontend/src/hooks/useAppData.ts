import { useEffect, useState } from 'react';
import { api } from '../api';
import { loadOrderDrafts, saveOrderDrafts } from '../store/orderDrafts';
import {
  Category,
  CashPreview,
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
} from '../types';

interface HistoryFilters {
  from?: string;
  to?: string;
  tableId?: string;
  status?: OrderStatus | '';
  paymentGroup?: 'COP' | 'BS' | 'USD' | 'ZELLE' | 'CARD' | '';
}

interface UseAppDataOptions {
  token?: string;
  session: UserSession | null;
  pathname: string;
  loadOrderHistory: (filters?: HistoryFilters) => Promise<void>;
  reloadDashboardStats: () => Promise<void>;
}

export function useAppData({
  token,
  session,
  pathname,
  loadOrderHistory,
  reloadDashboardStats,
}: UseAppDataOptions) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [menuProducts, setMenuProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tableDrafts, setTableDrafts] = useState<Record<string, OrderItem[]>>({});
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [draftsHydrated, setDraftsHydrated] = useState(false);

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

  const loadTables = async () => {
    if (!token) {
      return;
    }

    const result = await api<RestaurantTable[]>('/tables', 'GET', token);
    setTables(result);
  };

  const loadProducts = async () => {
    if (!token) {
      return;
    }

    const result = await api<Product[]>('/products', 'GET', token);
    setProducts(result);
    if (session?.role !== 'ADMIN') {
      setMenuProducts(result);
    }
  };

  const loadAdminMenuData = async () => {
    if (!token || session?.role !== 'ADMIN') {
      return;
    }

    const [adminProducts, categoriesResult] = await Promise.all([
      api<Product[]>('/products/admin', 'GET', token),
      api<Category[]>('/products/categories', 'GET', token),
    ]);

    setMenuProducts(adminProducts);
    setCategories(categoriesResult);
  };

  const loadKitchenOrders = async () => {
    if (!token) {
      return;
    }

    const result = await api<Order[]>('/orders/active', 'GET', token);
    setOrders(result);
  };

  const loadSalaData = async () => {
    await Promise.all([loadTables(), loadProducts()]);
  };

  const loadCashData = async () => {
    await loadTables();
  };

  const loadHistoryData = async () => {
    await Promise.all([loadTables(), loadOrderHistory()]);
  };

  const loadRouteData = async (nextPathname = pathname) => {
    if (!token) {
      return;
    }

    if (nextPathname.startsWith('/sala')) {
      await loadSalaData();
      return;
    }

    if (nextPathname.startsWith('/kds')) {
      await loadKitchenOrders();
      return;
    }

    if (nextPathname.startsWith('/caja')) {
      await loadCashData();
      return;
    }

    if (nextPathname.startsWith('/historial')) {
      await loadHistoryData();
      return;
    }

    if (nextPathname.startsWith('/menu')) {
      await loadAdminMenuData();
      return;
    }

    if (nextPathname.startsWith('/dashboard') && session?.role === 'ADMIN') {
      await reloadDashboardStats();
    }
  };

  const createOrder = async (
    tableId: string,
    items: OrderItem[],
    isDelivery?: boolean,
    deliveryAddress?: string,
  ): Promise<KitchenTicketPreview | null> => {
    if (!token || !session) {
      return null;
    }

    const orderPayload: any = {
      tableId,
      waiterId: session.id,
      items,
    };
    if (isDelivery) {
      orderPayload.isDelivery = true;
      orderPayload.deliveryAddress = deliveryAddress;
    }

    const order = await api<Order>('/orders', 'POST', token, orderPayload);

    let preview: KitchenTicketPreview | null = null;
    try {
      preview = await api<KitchenTicketPreview>(`/printing/kitchen-ticket/${order.id}`, 'GET', token);
    } catch {
      preview = null;
    }

    setTableDrafts((current) => ({ ...current, [tableId]: [] }));
    await loadRouteData('/sala');
    return preview;
  };

  const setOrderStatus = async (orderId: string, status: OrderStatus) => {
    if (!token) {
      return;
    }
    await api(`/orders/${orderId}/status`, 'PATCH', token, { status });
    await loadRouteData('/kds');
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
    await loadRouteData('/caja');
  };

  const getCashPreview = async (tableId: string): Promise<CashPreview> => {
    if (!token) {
      throw new Error('No token');
    }

    return api<CashPreview>(`/cash/preview/${tableId}`, 'GET', token);
  };

  const createTable = async (name: string, capacity: number, zone?: string) => {
    if (!token) {
      return;
    }
    await api('/tables', 'POST', token, { name, capacity, zone });
    await loadRouteData('/sala');
  };

  const changeTableStatus = async (tableId: string, status: TableStatus) => {
    if (!token) {
      return;
    }
    await api(`/tables/${tableId}/status`, 'PATCH', token, { status });
    await loadRouteData(pathname);
  };

  const renameTable = async (tableId: string, name: string) => {
    if (!token) {
      return;
    }
    await api(`/tables/${tableId}`, 'PATCH', token, { name });
    setSelectedTable((current) => (current?.id === tableId ? { ...current, name } : current));
    await loadRouteData('/sala');
  };

  const updateTableLayout = async (
    tableId: string,
    payload: { zone?: string; layoutX?: number; layoutY?: number },
  ) => {
    if (!token) {
      return;
    }
    await api(`/tables/${tableId}`, 'PATCH', token, payload);
    await loadRouteData('/sala');
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
    await loadRouteData('/sala');
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
      await loadRouteData('/sala');
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
        await loadRouteData('/sala');
      }
    }
  };

  const createProduct = async (payload: { name: string; price: number; categoryId?: string }) => {
    if (!token) {
      return;
    }
    await api('/products', 'POST', token, payload);
    await loadRouteData('/menu');
  };

  const updateProduct = async (
    id: string,
    payload: { name: string; price: number; categoryId?: string },
  ) => {
    if (!token) {
      return;
    }
    await api(`/products/${id}`, 'PATCH', token, payload);
    await loadRouteData('/menu');
  };

  const deleteProduct = async (id: string) => {
    if (!token) {
      return;
    }
    await api(`/products/${id}`, 'DELETE', token);
    await loadRouteData('/menu');
  };

  const setProductStatus = async (id: string, isActive: boolean) => {
    if (!token) {
      return;
    }
    await api(`/products/${id}/status`, 'PATCH', token, { isActive });
    await loadRouteData('/menu');
  };

  const createCategory = async (name: string, isPackaging?: boolean) => {
    if (!token) {
      return;
    }
    await api('/products/categories', 'POST', token, { name, isPackaging: Boolean(isPackaging) });
    await loadRouteData('/menu');
  };

  const updateCategory = async (
    id: string,
    payload: { name?: string; isPackaging?: boolean },
  ) => {
    if (!token) {
      return;
    }
    await api(`/products/categories/${id}`, 'PATCH', token, payload);
    await loadRouteData('/menu');
  };

  const deleteCategory = async (id: string) => {
    if (!token) {
      return;
    }
    await api(`/products/categories/${id}`, 'DELETE', token);
    await loadRouteData('/menu');
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
      await loadRouteData('/sala');
    }
  };


 const getKitchenTicketPreview = async (orderId: string): Promise<KitchenTicketPreview | null> => {
   if (!token || !session) {
      return null;
    }
    let preview: KitchenTicketPreview | null = null;
    try {
      preview = await api<KitchenTicketPreview>(`/printing/kitchen-ticket/${orderId}`, 'GET', token);
    } catch {
      preview = null;
    }
    
    await loadRouteData('/historial');
    return preview;
}

  return {
    getKitchenTicketPreview,
    tables,
    products,
    menuProducts,
    categories,
    orders,
    tableDrafts,
    setTableDrafts,
    selectedTable,
    setSelectedTable,
    loadRouteData,
    createOrder,
    setOrderStatus,
    closeTable,
    getCashPreview,
    createTable,
    changeTableStatus,
    renameTable,
    updateTableLayout,
    deleteTable,
    swapTables,
    createProduct,
    updateProduct,
    deleteProduct,
    setProductStatus,
    createCategory,
    updateCategory,
    deleteCategory,
    ensureTableOccupied,
  };
}
