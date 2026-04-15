import { KitchenBoard } from '../components/KitchenBoard';
import { Order, OrderStatus } from '../types';

interface Props {
  orders: Order[];
  onSetStatus: (orderId: string, status: OrderStatus) => Promise<void>;
}

export function KitchenPage({ orders, onSetStatus }: Props) {
  return <KitchenBoard orders={orders} onSetStatus={onSetStatus} />;
}
