import { useState } from 'react';
import { CashPreview, PaymentMethod, RestaurantTable } from '../types';

interface Props {
  tables: RestaurantTable[];
  userId: string;
  onCloseTable: (tableId: string, method: PaymentMethod) => Promise<void>;
  onPreviewTable: (tableId: string) => Promise<CashPreview>;
}

const PAYMENT_OPTIONS: Array<{ method: PaymentMethod; label: string }> = [
  { method: 'CASH_COP', label: 'COP' },
  { method: 'POS', label: 'Punto de venta (Bs)' },
  { method: 'MOBILE_PAYMENT', label: 'Pago movil (Bs)' },
  { method: 'USD', label: 'Dolares' },
  { method: 'ZELLE', label: 'Zelle' },
];

export function CashPanel({ tables, onCloseTable, onPreviewTable }: Props) {
  const occupied = tables.filter((t) =>
    ['OCCUPIED', 'RESERVED', 'BILLING'].includes(t.status),
  );
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('CASH_COP');
  const [preview, setPreview] = useState<CashPreview | null>(null);
  const [loading, setLoading] = useState(false);

  const openPreview = async (tableId: string) => {
    setLoading(true);
    setSelectedTableId(tableId);
    try {
      const data = await onPreviewTable(tableId);
      setPreview(data);
    } finally {
      setLoading(false);
    }
  };

  const closeWithMethod = async (method: PaymentMethod) => {
    if (!selectedTableId) {
      return;
    }
    await onCloseTable(selectedTableId, method);
    setPreview(null);
    setSelectedTableId(null);
  };

  return (
    <section className="panel">
      <h3>Caja</h3>
      <div className="cash-list">
        {occupied.map((table) => (
          <article key={table.id} className="cash-item">
            <strong>{table.name}</strong>
            <div>
              <button onClick={() => openPreview(table.id)}>
                {selectedTableId === table.id && loading ? 'Cargando...' : 'Ver detalle'}
              </button>
            </div>
          </article>
        ))}
      </div>

      {preview && (
        <section className="cash-preview">
          <h4>Detalle de cuenta - {preview.table.name}</h4>
          <table className="cash-detail-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cant</th>
                <th>Precio</th>
                <th>Total</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {preview.items.map((item, index) => (
                <tr key={`${item.orderId}-${item.productId}-${index}`}>
                  <td>{item.productName}</td>
                  <td>{item.quantity}</td>
                  <td>${item.unitPrice.toFixed(2)}</td>
                  <td>${item.lineTotal.toFixed(2)}</td>
                  <td className="cash-note">{item.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="cash-totals">
            <p>Subtotal: ${preview.subtotal.toFixed(2)}</p>
            <p>IVA: ${preview.tax.toFixed(2)}</p>
            <p>Total: ${preview.total.toFixed(2)}</p>
            <p>Total Bs: {preview.conversions.bs.toFixed(2)}</p>
            <p>Total USD: {preview.conversions.usd.toFixed(2)}</p>
          </div>

          <div className="cash-conversion-grid">
            <article><strong>COP</strong><span>${preview.conversions.cop.toFixed(2)}</span></article>
            <article><strong>Bs</strong><span>{preview.conversions.bs.toFixed(2)}</span></article>
            <article><strong>USD</strong><span>{preview.conversions.usd.toFixed(2)}</span></article>
          </div>

          <div className="cash-payment-selector">
            <label htmlFor="payment-method">Tipo de pago</label>
            <select
              id="payment-method"
              value={selectedMethod}
              onChange={(event) => setSelectedMethod(event.target.value as PaymentMethod)}
            >
              {PAYMENT_OPTIONS.map((option) => (
                <option key={option.method} value={option.method}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="cash-actions">
            <button onClick={() => closeWithMethod(selectedMethod)}>Cerrar cuenta</button>
          </div>
        </section>
      )}
    </section>
  );
}
