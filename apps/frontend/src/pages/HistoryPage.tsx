import { useState } from 'react';
import { OrderHistoryPanel } from '../components/OrderHistoryPanel';
import { DashboardStats, KitchenTicketPreview, OrderHistoryRecord, OrderStatus, RestaurantTable, UserSession} from '../types';
import { loadSession } from '../store/auth';
import { useOrderHistory } from '../hooks/useOrderHistory';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAppData } from '../hooks/useAppData';

interface Props {
  tables: RestaurantTable[];
  orders: OrderHistoryRecord[];
  loading: boolean;
  exchangeRates?: DashboardStats['exchangeRates'];
  onSearch: (filters: {
    from?: string;
    to?: string;
    tableId?: string;
    status?: OrderStatus | '';
    paymentGroup?: 'COP' | 'BS' | 'USD' | 'ZELLE' | 'CARD' | '';
  }) => Promise<void>;
  onReprint: (orderId: string) => Promise<KitchenTicketPreview | null>;
  onPrintKitchenTicket: (orderId: string) => Promise<void>;
  onPrintOrderReceipt: (orderId: string) => Promise<void>;
}


export function HistoryPage(props: Props) {

  
 const [session, setSession] = useState<UserSession | null>(loadSession());

  const token = session?.accessToken;
  const { loadOrderHistory } = useOrderHistory(token);

  const { reloadDashboardStats } = useDashboardData(
    token,
    session?.role === "ADMIN"
  );

  const appData = useAppData({
    token,
    session,
    pathname: location.pathname,
    loadOrderHistory,
    reloadDashboardStats,
  });

  return <OrderHistoryPanel {...props} getKitchenTicket={appData.getKitchenTicketPreview} />;
}
