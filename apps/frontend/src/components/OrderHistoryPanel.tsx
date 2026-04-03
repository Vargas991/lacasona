import { useMemo, useState } from 'react';
import {
  KitchenTicketPreview,
  OrderHistoryRecord,
  OrderStatus,
  PaymentMethod,
  RestaurantTable,
} from '../types';

interface HistoryFilters {
  from?: string;
  to?: string;
  tableId?: string;
  status?: OrderStatus | '';
  paymentGroup?: 'COP' | 'BS' | 'USD' | 'ZELLE' | 'CARD' | '';
}

interface Props {
  tables: RestaurantTable[];
  orders: OrderHistoryRecord[];
  loading: boolean;
  exchangeRates?: {
    copToBsDivisor: number;
    copToUsdDivisor: number;
  };
  onSearch: (filters: HistoryFilters) => Promise<void>;
  onReprint: (orderId: string) => Promise<KitchenTicketPreview | null>;
}

const STATUS_OPTIONS: Array<OrderStatus | ''> = ['', 'PENDING', 'PREPARING', 'READY', 'DELIVERED'];

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pendiente',
  PREPARING: 'En preparacion',
  READY: 'Listo',
  DELIVERED: 'Entregado',
};
const PAYMENT_GROUP_OPTIONS: Array<'COP' | 'BS' | 'USD' | 'ZELLE' | 'CARD' | ''> = [
  '',
  'COP',
  'BS',
  'USD',
  'ZELLE',
  'CARD',
];

const PAYMENT_GROUP_LABEL: Record<'COP' | 'BS' | 'USD' | 'ZELLE' | 'CARD', string> = {
  COP: 'COP',
  BS: 'Bolivares (POS / Pago movil)',
  USD: 'Dolares',
  ZELLE: 'Zelle',
  CARD: 'Tarjeta',
};

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  CASH: 'COP',
  CARD: 'Tarjeta',
  CASH_COP: 'COP',
  BOLIVARES: 'Bolivares (POS / Pago movil)',
  POS: 'Bolivares (POS / Pago movil)',
  MOBILE_PAYMENT: 'Bolivares (POS / Pago movil)',
  USD: 'Dolares',
  ZELLE: 'Zelle',
};

function dateToInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function getPeriodRange(period: 'today' | 'yesterday' | 'last7' | 'month') {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'today') {
    const date = dateToInput(today);
    return { from: date, to: date };
  }

  if (period === 'yesterday') {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    const value = dateToInput(date);
    return { from: value, to: value };
  }

  if (period === 'last7') {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: dateToInput(from), to: dateToInput(today) };
  }

  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: dateToInput(firstDay), to: dateToInput(today) };
}

export function OrderHistoryPanel({
  tables,
  orders,
  loading,
  exchangeRates,
  onSearch,
  onReprint,
}: Props) {
  const [filters, setFilters] = useState<HistoryFilters>({});
  const [selectedOrder, setSelectedOrder] = useState<OrderHistoryRecord | null>(null);
  const [reprintLoading, setReprintLoading] = useState(false);

  const printPreview = (preview: KitchenTicketPreview) => {
    const popup = window.open('', '_blank', 'width=420,height=640');
    if (!popup) {
      window.alert('No se pudo abrir ventana de impresion. Revisa el bloqueador de ventanas.');
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>Comanda Cocina</title>
          <style>
            body { font-family: monospace; padding: 16px; }
            pre { white-space: pre-wrap; font-size: 14px; }
          </style>
        </head>
        <body>
          <pre>${preview.previewText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const totalOrders = orders.length;
  const totalSales = useMemo(
    () =>
      orders.reduce((sum, order) => {
        if (order.payment?.total) {
          return sum + Number(order.payment.total);
        }
        return sum;
      }, 0),
    [orders],
  );

  const getFallbackAmountByMethod = (method: PaymentMethod, totalCop: number) => {
    if (['BOLIVARES', 'POS', 'MOBILE_PAYMENT'].includes(method) && exchangeRates) {
      return totalCop / exchangeRates.copToBsDivisor;
    }

    if (['USD', 'ZELLE'].includes(method) && exchangeRates) {
      return totalCop / exchangeRates.copToUsdDivisor;
    }

    return totalCop;
  };

  const formatPaymentAmount = (method: PaymentMethod, amount: number) => {
    if (['BOLIVARES', 'POS', 'MOBILE_PAYMENT'].includes(method)) {
      return `Bs ${amount.toFixed(2)}`;
    }

    if (['USD', 'ZELLE'].includes(method)) {
      return `USD ${amount.toFixed(2)}`;
    }

    return `COP ${amount.toFixed(2)}`;
  };

  const paymentsSummary = useMemo(() => {
    const map = new Map<PaymentMethod, { count: number; total: number }>();
    for (const order of orders) {
      if (!order.payment) {
        continue;
      }

      const persistedAmount = order.payment.paidAmount ? Number(order.payment.paidAmount) : null;
      const totalForSummary =
        persistedAmount !== null && Number.isFinite(persistedAmount)
          ? persistedAmount
          : getFallbackAmountByMethod(order.payment.method, Number(order.payment.total));

      const current = map.get(order.payment.method) || { count: 0, total: 0 };
      current.count += 1;
      current.total += totalForSummary;
      map.set(order.payment.method, current);
    }

    return Array.from(map.entries())
      .map(([method, value]) => ({ method, ...value }))
      .sort((a, b) => b.total - a.total);
  }, [orders, exchangeRates]);

  const formatPersistedPaymentAmount = (payment: NonNullable<OrderHistoryRecord['payment']>) => {
    const persistedAmount = payment.paidAmount ? Number(payment.paidAmount) : null;
    const persistedCurrency = payment.paidCurrency;

    if (persistedAmount !== null && Number.isFinite(persistedAmount) && persistedCurrency) {
      if (persistedCurrency === 'BS') {
        return `Bs ${persistedAmount.toFixed(2)}`;
      }

      if (persistedCurrency === 'USD') {
        return `USD ${persistedAmount.toFixed(2)}`;
      }

      return `COP ${persistedAmount.toFixed(2)}`;
    }

    const fallbackAmount = getFallbackAmountByMethod(payment.method, Number(payment.total));
    return formatPaymentAmount(payment.method, fallbackAmount);
  };

  return (
    <section className="panel history-panel">
      <h3>Historial de Comandas</h3>

      <form
        className="history-filters"
        onSubmit={async (event) => {
          event.preventDefault();
          await onSearch(filters);
        }}
      >
        <div className="history-periods">
          <button
            type="button"
            onClick={async () => {
              const next = { ...filters, ...getPeriodRange('today') };
              setFilters(next);
              await onSearch(next);
            }}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={async () => {
              const next = { ...filters, ...getPeriodRange('yesterday') };
              setFilters(next);
              await onSearch(next);
            }}
          >
            Ayer
          </button>
          <button
            type="button"
            onClick={async () => {
              const next = { ...filters, ...getPeriodRange('last7') };
              setFilters(next);
              await onSearch(next);
            }}
          >
            Ultimos 7 dias
          </button>
          <button
            type="button"
            onClick={async () => {
              const next = { ...filters, ...getPeriodRange('month') };
              setFilters(next);
              await onSearch(next);
            }}
          >
            Mes actual
          </button>
        </div>
        <input
          type="date"
          value={filters.from || ''}
          onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value || undefined }))}
        />
        <input
          type="date"
          value={filters.to || ''}
          onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value || undefined }))}
        />
        <select
          value={filters.tableId || ''}
          onChange={(event) =>
            setFilters((current) => ({ ...current, tableId: event.target.value || undefined }))
          }
        >
          <option value="">Todas las mesas</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.name}
            </option>
          ))}
        </select>
        <select
          value={filters.status || ''}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              status: (event.target.value as OrderStatus | '') || undefined,
            }))
          }
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status || 'ALL'} value={status}>
              {status ? STATUS_LABEL[status] : 'Todos los estados'}
            </option>
          ))}
        </select>
        <select
          value={filters.paymentGroup || ''}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              paymentGroup:
                (event.target.value as 'COP' | 'BS' | 'USD' | 'ZELLE' | 'CARD' | '') ||
                undefined,
            }))
          }
        >
          {PAYMENT_GROUP_OPTIONS.map((group) => (
            <option key={group || 'ALL_METHODS'} value={group}>
              {group ? PAYMENT_GROUP_LABEL[group] : 'Todos los pagos'}
            </option>
          ))}
        </select>
        <button type="submit" disabled={loading}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      <div className="history-summary">
        <strong>{totalOrders} comandas</strong>
        <span>Ventas cerradas: ${totalSales.toFixed(2)}</span>
      </div>

      <div className="history-payment-summary">
        {paymentsSummary.map((item) => (
          <article key={item.method}>
            <h4>{PAYMENT_LABEL[item.method]}</h4>
            <p>{item.count} pagos</p>
            <strong>{formatPaymentAmount(item.method, item.total)}</strong>
          </article>
        ))}
        {!paymentsSummary.length && <p>No hay pagos para el periodo/filtros seleccionados.</p>}
      </div>

      <div className="history-list">
        {orders.map((order) => {
          const total = order.items.reduce(
            (sum, item) => sum + Number(item.unitPrice) * item.quantity,
            0,
          );

          return (
            <article key={order.id} className="history-item">
              <header>
                <strong>
                  #{String(order.dailySequence).padStart(3, '0')} - {order.table.name}
                </strong>
                <span>{new Date(order.createdAt).toLocaleString()}</span>
              </header>
              <p>
                Estado: {STATUS_LABEL[order.status]} | Mesero: {order.waiter.name}
              </p>
              <p>Total comanda: ${total.toFixed(2)}</p>
              {order.payment ? (
                <p>
                  Cobro: {formatPersistedPaymentAmount(order.payment)} ({PAYMENT_LABEL[order.payment.method]})
                </p>
              ) : (
                <p>Sin cobro registrado</p>
              )}
              <div className="history-actions">
                <button type="button" onClick={() => setSelectedOrder(order)}>
                  Ver comanda
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setReprintLoading(true);
                    try {
                      const preview = await onReprint(order.id);
                      if (!preview) {
                        window.alert('No se pudo generar la reimpresion.');
                        return;
                      }
                      if (!preview.printable) {
                        window.alert(`La comanda no es imprimible:\n- ${preview.validationErrors.join('\n- ')}`);
                        return;
                      }
                      printPreview(preview);
                    } finally {
                      setReprintLoading(false);
                    }
                  }}
                  disabled={reprintLoading}
                >
                  {reprintLoading ? 'Procesando...' : 'Reimprimir'}
                </button>
              </div>
            </article>
          );
        })}

        {!orders.length && <p>No hay resultados para los filtros seleccionados.</p>}
      </div>

      {selectedOrder && (
        <div className="print-modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <section className="print-modal" onClick={(event) => event.stopPropagation()}>
            <header className="print-modal-header">
              <h4>
                Comanda #{String(selectedOrder.dailySequence).padStart(3, '0')} - {selectedOrder.table.name}
              </h4>
              <button type="button" onClick={() => setSelectedOrder(null)}>
                Cerrar
              </button>
            </header>

            <p>
              Fecha: {new Date(selectedOrder.createdAt).toLocaleString()} | Mesero: {selectedOrder.waiter.name}
            </p>
            <p>Estado: {selectedOrder.status}</p>

            <div className="history-detail-list">
              {selectedOrder.items.map((item) => (
                <article key={item.id} className="history-detail-item">
                  <strong>
                    {item.quantity} x {item.product.name}
                  </strong>
                  <span>Precio unitario: ${Number(item.unitPrice).toFixed(2)}</span>
                  <span>Total item: ${(Number(item.unitPrice) * item.quantity).toFixed(2)}</span>
                  {item.note ? <small>Nota: {item.note}</small> : null}
                </article>
              ))}
            </div>

            <p className="history-detail-total">
              Total pedido: $
              {selectedOrder.items
                .reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0)
                .toFixed(2)}
            </p>

            <div className="history-actions">
              <button
                type="button"
                onClick={async () => {
                  setReprintLoading(true);
                  try {
                    const preview = await onReprint(selectedOrder.id);
                    if (!preview) {
                      window.alert('No se pudo generar la reimpresion.');
                      return;
                    }
                    if (!preview.printable) {
                      window.alert(`La comanda no es imprimible:\n- ${preview.validationErrors.join('\n- ')}`);
                      return;
                    }
                    printPreview(preview);
                  } finally {
                    setReprintLoading(false);
                  }
                }}
                disabled={reprintLoading}
              >
                {reprintLoading ? 'Procesando...' : 'Reimprimir'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
