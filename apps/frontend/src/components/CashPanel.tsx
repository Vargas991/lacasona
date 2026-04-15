// Utilidad para imprimir el preview desde el navegador
function printPreviewInBrowser(preview: CashPreview) {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) return;
  // Generar texto tipo recibo térmico
  let text = '';
  text += `          LA CASONA\n`;
  text += `            RECIBO\n\n`;
  text += preview.orders[0].isDelivery && preview.table.name =="Delivery"
      ? `DELIVERY`
      : !preview.orders[0].isDelivery ? `Mesa: ${preview.table.name}`
      : `**PEDIDO PARA LLEVAR** \nMesa: ${preview.table.name}`

  // text += `MESA: ${preview.table.name}\n`;
  // text += `FECHA: ${new Date().toLocaleString()}\n`;
  if(preview.orders[0].isDelivery){
  // text += '------------------------\n';
  //   text += 'PEDIDO PARA LLEVAR\n';
    text += `\nDIRECCIÓN: ${preview.orders[0].deliveryAddress}\n`;
  }
  text += '\n-------------------\n';
  preview.items.forEach(item => {
    text += `${item.quantity} x ${item.productName}`.padEnd(2) + ` $${item.unitPrice.toFixed(2)}\n`;
    // if (item.note) text += `\nNota: ${item.note}\n`;
  });
  text += '---------------------\n';
  // text += `SUBTOTAL: $${preview.subtotal.toFixed(2)}\n`;
  // text += `IVA: $${preview.tax.toFixed(2)}\n`;
  text += `TOTAL: $${preview.total.toFixed(2)}\n`;
  text += '---------------------\n';
  text += `Bs: ${preview.conversions.bs.toFixed(2)}\n`;
  text += `USD: ${preview.conversions.usd.toFixed(2)}\n`;
  text += '\n\n';
  printWindow.document.write(`
    <html>
      <head>
        <title>Recibo - ${preview.table.name}</title>
        <style>
          body { font-family: monospace; font-size: 14px; width: 58mm; margin: 0; padding: 8px; }
          pre { white-space: pre-wrap; word-break: break-all; font-size: 14px; }
        </style>
      </head>
      <body>
        <pre>${text}</pre>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}
import { useState } from 'react';
import { ModalConfirm } from './ModalConfirm';
import { CashPreview, PaymentMethod, RestaurantTable } from '../types';

interface Props {
  tables: RestaurantTable[];
  userId: string;
  onCloseTable: (tableId: string, method: PaymentMethod) => Promise<void>;
  onPreviewTable: (tableId: string) => Promise<CashPreview>;
  onPrintInvoice: (tableId: string) => Promise<void>;
}

const PAYMENT_OPTIONS: Array<{ method: PaymentMethod; label: string }> = [
  { method: 'CASH_COP', label: 'COP' },
  { method: 'POS', label: 'Punto de venta (Bs)' },
  { method: 'MOBILE_PAYMENT', label: 'Pago movil (Bs)' },
  { method: 'USD', label: 'Dolares' },
  { method: 'ZELLE', label: 'Zelle' },
];

export function CashPanel({ tables, onCloseTable, onPreviewTable, onPrintInvoice }: Props) {
  const occupied = tables.filter((t) =>
    ['OCCUPIED', 'RESERVED', 'BILLING'].includes(t.status),
  );
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('CASH_COP');
  const [preview, setPreview] = useState<CashPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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
    setShowConfirmModal(false);
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
            {/* <p>Subtotal: ${preview.subtotal.toFixed(2)}</p>
            <p>IVA: ${preview.tax.toFixed(2)}</p> */}
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
            {/* <button
              type="button"
              onClick={async () => {
                if (!selectedTableId) {
                  return;
                }
                try {
                  await onPrintInvoice(selectedTableId);
                  window.alert('Factura enviada a la impresora.');
                } catch (error) {
                  window.alert(
                    'No se pudo imprimir la factura: ' + (error as Error).message,
                  );
                }
              }}
            >
              Imprimir factura (backend)
            </button> */}
            <button
              type="button"
              onClick={() => preview && printPreviewInBrowser(preview)}
            >
              Imprimir 
            </button>
            <button onClick={() => setShowConfirmModal(true)}>Cerrar cuenta</button>
            <ModalConfirm
              open={showConfirmModal}
              title="¿Confirmar cierre de cuenta?"
              message={`¿Deseas cerrar la cuenta con el método: ${PAYMENT_OPTIONS.find(opt => opt.method === selectedMethod)?.label || selectedMethod}?`}
              confirmLabel="Confirmar"
              cancelLabel="Cancelar"
              onConfirm={() => closeWithMethod(selectedMethod)}
              onCancel={() => setShowConfirmModal(false)}
            />
          </div>
        </section>
      )}
    </section>
  );
}
