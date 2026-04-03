import { useMemo } from 'react';
import { Order, OrderStatus } from '../types';

interface Props {
  orders: Order[];
  onSetStatus: (orderId: string, status: OrderStatus) => Promise<void>;
}

const statusFlow: OrderStatus[] = ['PENDING', 'PREPARING', 'READY', 'DELIVERED'];
const boardStatuses = ['PENDING', 'PREPARING', 'READY'] as const;
type BoardStatus = (typeof boardStatuses)[number];

const statusLabel: Record<OrderStatus, string> = {
  PENDING: 'Pendiente',
  PREPARING: 'En preparacion',
  READY: 'Listo',
  DELIVERED: 'Entregado',
};

function formatKitchenTime(value: string) {
  return new Date(value).toLocaleTimeString('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatOrderNumber(sequence: number) {
  return `#${String(sequence).padStart(3, '0')}`;
}

export function KitchenBoard({ orders, onSetStatus }: Props) {
  const nextStatus = (current: OrderStatus) => {
    const idx = statusFlow.indexOf(current);
    return statusFlow[Math.min(idx + 1, statusFlow.length - 1)];
  };

  const groupedOrders = useMemo<Record<BoardStatus, Order[]>>(() => {
    // FIFO en cocina: primero se atienden los pedidos mas antiguos.
    const sortedOldestFirst = [...orders].sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });

    return {
      PENDING: sortedOldestFirst.filter((order) => order.status === 'PENDING'),
      PREPARING: sortedOldestFirst.filter((order) => order.status === 'PREPARING'),
      READY: sortedOldestFirst.filter((order) => order.status === 'READY'),
    };
  }, [orders]);

  return (
    <section className="panel kitchen">
      <h3>KDS Cocina</h3>
      <div className="kds-columns">
        {boardStatuses.map((status) => (
          <section key={status} className="kds-column">
            <header className="kds-column-header">
              <strong>{statusLabel[status]}</strong>
              <span>{groupedOrders[status].length}</span>
            </header>

            <div className="kds-grid">
              {groupedOrders[status].map((order) => (
                <article key={order.id} className="kds-card">
                  <header>
                    <span>{formatOrderNumber(order.dailySequence)}</span>
                    <br />
                    <strong>{order.table.name}</strong>
                    <br />
                    <span>Hora: {formatKitchenTime(order.createdAt)}</span>
                  </header>
                  <ul>
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {item.quantity} x {item.product.name}
                        {item.note ? <span className="kitchen-note"> <br/>{item.note}</span> : ''}
                      </li>
                    ))}
                  </ul>
                  <button
                    className="touch-btn"
                    onClick={() => onSetStatus(order.id, nextStatus(order.status))}
                    disabled={order.status === 'DELIVERED'}
                  >
                    Siguiente estado
                  </button>
                </article>
              ))}

              {groupedOrders[status].length === 0 && (
                <p className="kds-empty">Sin comandas</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
