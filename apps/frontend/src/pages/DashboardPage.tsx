import { DashboardCards } from '../components/DashboardCards';
import { DashboardStats } from '../types';

interface Props {
  stats: DashboardStats | null;
  filters: {
    from?: string;
    to?: string;
  };
  onLoadStats: (filters: { from?: string; to?: string }) => Promise<void>;
  onSaveExchangeRates: (payload: {
    copToBsDivisor: number;
    copToUsdDivisor: number;
  }) => Promise<void>;
}

export function DashboardPage(props: Props) {
  return <DashboardCards {...props} />;
}
