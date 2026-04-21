import { useEffect, useMemo, useState } from 'react';
import { api, flushOfflineQueue } from './api';
import { AppNav } from './components/AppNav';
import { LoginForm } from './components/LoginForm';
import { useAppData } from './hooks/useAppData';
import { useDashboardData } from './hooks/useDashboardData';
import { useOrderHistory } from './hooks/useOrderHistory';
import { usePrintingActions } from './hooks/usePrintingActions';
import { AppRoutes } from './routes/AppRoutes';
import { clearSession, loadSession, saveSession } from './store/auth';
import { connectSocket, getSocket } from './store/socket';
import { UserSession } from './types';
import { useLocation } from 'react-router-dom';

function App() {
  const [session, setSession] = useState<UserSession | null>(loadSession());
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const location = useLocation();
  const token = session?.accessToken;

  const {
    stats,
    dashboardFilters,
    loadDashboardStats,
    reloadDashboardStats,
  } = useDashboardData(token, session?.role === 'ADMIN');
  const { historyOrders, historyLoading, loadOrderHistory } = useOrderHistory(token);
  const {
    printKitchenTicket,
    reprintKitchenTicket,
    printInvoice,
    printOrderReceipt,
  } = usePrintingActions(token);
  const appData = useAppData({
    token,
    session,
    pathname: location.pathname,
    loadOrderHistory,
    reloadDashboardStats,
  });

  useEffect(() => {
    if (!token) {
      return;
    }

    appData.loadRouteData();
    flushOfflineQueue(token).then(() => appData.loadRouteData()).catch(() => undefined);

    const socket = connectSocket();
    const refresh = () => appData.loadRouteData();

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
  }, [token, location.pathname, session?.role]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!token || !isOnline) {
      return;
    }

    flushOfflineQueue(token).then(() => appData.loadRouteData()).catch(() => undefined);
  }, [token, isOnline]);

  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      setSession(null);
    };

    window.addEventListener('lacasona:unauthorized', onUnauthorized);
    return () => window.removeEventListener('lacasona:unauthorized', onUnauthorized);
  }, []);

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

  const handleDashboardExchangeRates = async (payload: {
    copToBsDivisor: number;
    copToUsdDivisor: number;
  }) => {
    if (!token) {
      return;
    }

    await api('/dashboard/exchange-rates', 'PATCH', token, payload);
    await appData.loadRouteData('/dashboard');
  };

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

      {!isOnline && (
        <div className="network-status-banner offline">
          Sin conexion. Los cambios se guardaran en cola hasta recuperar la red.
        </div>
      )}

      <AppNav role={session.role} />

      <AppRoutes
        sessionRole={session.role}
        userId={session.id}
        tables={appData.tables}
        selectedTable={appData.selectedTable}
        products={appData.products}
        tableDrafts={appData.tableDrafts}
        menuProducts={appData.menuProducts}
        categories={appData.categories}
        orders={appData.orders}
        historyOrders={historyOrders}
        historyLoading={historyLoading}
        stats={stats}
        dashboardFilters={dashboardFilters}
        setSelectedTable={appData.setSelectedTable}
        onUpdateLayout={appData.updateTableLayout}
        onMoveTable={appData.swapTables}
        onChangeItems={(items) => {
          if (!appData.selectedTable) {
            return;
          }

          const previousItems = appData.tableDrafts[appData.selectedTable.id] || [];
          const switchedToDraftWithItems = previousItems.length === 0 && items.length > 0;
          const tableState = appData.tables.find((table) => table.id === appData.selectedTable?.id);

          if (switchedToDraftWithItems && tableState?.status === 'FREE') {
            void appData.ensureTableOccupied(appData.selectedTable.id);
          }

          appData.setTableDrafts((current) => ({
            ...current,
            [appData.selectedTable!.id]: items,
          }));
        }}
        onCreateOrder={appData.createOrder}
        onPrintKitchenTicket={printKitchenTicket}
        onCreateTable={appData.createTable}
        onRenameTable={appData.renameTable}
        onChangeStatus={appData.changeTableStatus}
        onDeleteTable={appData.deleteTable}
        onSetStatus={appData.setOrderStatus}
        onCloseTable={appData.closeTable}
        onPreviewTable={appData.getCashPreview}
        onPrintInvoice={printInvoice}
        onLoadActiveCashSession={appData.getActiveCashSession}
        onOpenCashSession={appData.openCashSession}
        onCloseCashSession={appData.closeCashSession}
        onCalculateCashChange={appData.calculateCashChange}
        onHistorySearch={loadOrderHistory}
        onReprintKitchen={reprintKitchenTicket}
        onPrintOrderReceipt={printOrderReceipt}
        onCreateProduct={appData.createProduct}
        onUpdateProduct={appData.updateProduct}
        onDeleteProduct={appData.deleteProduct}
        onSetProductStatus={appData.setProductStatus}
        onCreateCategory={appData.createCategory}
        onUpdateCategory={appData.updateCategory}
        onDeleteCategory={appData.deleteCategory}
        onLoadStats={loadDashboardStats}
        onSaveExchangeRates={handleDashboardExchangeRates}
      />
    </main>
  );
}

export default App;
