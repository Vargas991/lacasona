import { useState } from 'react';
import { api } from '../api';
import { OrderHistoryRecord, OrderStatus } from '../types';

interface HistoryFilters {
  from?: string;
  to?: string;
  tableId?: string;
  status?: OrderStatus | '';
  paymentGroup?: 'COP' | 'BS' | 'USD' | 'ZELLE' | 'CARD' | 'BANCOLOMBIA' | '';
}

export function useOrderHistory(token?: string) {
  const [historyOrders, setHistoryOrders] = useState<OrderHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadOrderHistory = async (filters?: HistoryFilters) => {
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

  return {
    historyOrders,
    historyLoading,
    loadOrderHistory,
  };
}
