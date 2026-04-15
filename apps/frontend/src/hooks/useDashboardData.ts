import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { DashboardStats } from '../types';

interface DashboardFilters {
  from?: string;
  to?: string;
}

function dateToInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function getTodayRange(): DashboardFilters {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const value = dateToInput(today);
  return { from: value, to: value };
}

export function useDashboardData(token?: string, enabled = false) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilters>(getTodayRange);
  const dashboardFiltersRef = useRef(dashboardFilters);

  useEffect(() => {
    dashboardFiltersRef.current = dashboardFilters;
  }, [dashboardFilters]);

  const loadDashboardStats = async (filters?: DashboardFilters) => {
    if (!token || !enabled) {
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

  const reloadDashboardStats = async () => {
    if (!token || !enabled) {
      return;
    }

    try {
      const params = new URLSearchParams();
      const currentFilters = dashboardFiltersRef.current;
      if (currentFilters.from) params.set('from', currentFilters.from);
      if (currentFilters.to) params.set('to', currentFilters.to);
      const query = params.toString();
      const path = query ? `/dashboard/stats?${query}` : '/dashboard/stats';
      const nextStats = await api<DashboardStats>(path, 'GET', token);
      setStats(nextStats);
    } catch {
      setStats(null);
    }
  };

  return {
    stats,
    dashboardFilters,
    loadDashboardStats,
    reloadDashboardStats,
  };
}
