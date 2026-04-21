import { useEffect, useMemo, useRef, useState } from 'react';
import { ModalConfirm } from './ModalConfirm';
import {
  CashChangeQuote,
  CashPreview,
  CashSessionSummary,
  PaymentCurrency,
  PaymentMethod,
  RestaurantTable,
} from '../types';

function printPreviewInBrowser(preview: CashPreview) {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) return;

  let text = '';
  text += `          LA CASONA\n`;
  text += `            RECIBO\n\n`;
  text +=
    preview.orders[0].isDelivery && preview.table.name == 'Delivery'
      ? `DELIVERY`
      : !preview.orders[0].isDelivery
        ? `Mesa: ${preview.table.name}`
        : `**PEDIDO PARA LLEVAR** \nMesa: ${preview.table.name}`;

  if (preview.orders[0].isDelivery) {
    text += `\nDIRECCION: ${preview.orders[0].deliveryAddress}\n`;
  }
  text += '\n-------------------\n';
  preview.items.forEach((item) => {
    text += `${item.quantity} x ${item.productName}`.padEnd(2) + ` $${formatCompactNumber(item.unitPrice)}\n`;
  });
  text += '---------------------\n';
  text += `TOTAL: $${formatCompactNumber(preview.total)}\n`;
  text += '---------------------\n';
  text += `Bs: ${formatCompactNumber(preview.conversions.bs)}\n`;
  text += `USD: ${formatCompactNumber(preview.conversions.usd)}\n`;
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

interface Props {
  tables: RestaurantTable[];
  userId: string;
  onCloseTable: (payload: {
    tableId: string;
    method: PaymentMethod;
    tenderedCurrency?: PaymentCurrency;
    tenderedAmount?: number;
    changeCurrency?: PaymentCurrency;
    registerInCashSession?: boolean;
    note?: string;
  }) => Promise<void>;
  onPreviewTable: (tableId: string) => Promise<CashPreview>;
  onPrintInvoice: (tableId: string) => Promise<void>;
  onLoadActiveCashSession: () => Promise<CashSessionSummary | null>;
  onOpenCashSession: (payload: {
    openingCop: number;
    openingBs: number;
    openingUsd: number;
    openingNote?: string;
  }) => Promise<CashSessionSummary>;
  onCloseCashSession: (payload: {
    sessionId: string;
    countedCop?: number;
    countedBs?: number;
    countedUsd?: number;
    closingNote?: string;
  }) => Promise<void>;
  onCalculateCashChange: (payload: {
    totalAmount: number;
    totalCurrency: PaymentCurrency;
    tenderedAmount: number;
    tenderedCurrency: PaymentCurrency;
    changeCurrency?: PaymentCurrency;
  }) => Promise<CashChangeQuote>;
}

const OPENING_BALANCES_KEY = 'lacasona.cash.opening-balances';

function loadOpeningBalancesDraft() {
  const fallback = { cop: '0', bs: '0', usd: '0' };

  try {
    const raw = window.localStorage.getItem(OPENING_BALANCES_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as { cop?: number; bs?: number; usd?: number };
    return {
      cop: String(parsed.cop ?? 0),
      bs: String(parsed.bs ?? 0),
      usd: String(parsed.usd ?? 0),
    };
  } catch {
    return fallback;
  }
}

function saveOpeningBalancesDraft(payload: { cop: number; bs: number; usd: number }) {
  window.localStorage.setItem(OPENING_BALANCES_KEY, JSON.stringify(payload));
}

const PAYMENT_OPTIONS: Array<{ method: PaymentMethod; label: string }> = [
  { method: 'CASH_COP', label: 'COP' },
  { method: 'POS', label: 'Punto de venta (Bs)' },
  { method: 'MOBILE_PAYMENT', label: 'Pago movil (Bs)' },
  { method: 'USD', label: 'Dolares' },
  { method: 'ZELLE', label: 'Zelle' },
  { method: 'BANCOLOMBIA', label: 'Bancolombia' },
];

const CURRENCY_OPTIONS: Array<{ value: PaymentCurrency; label: string }> = [
  { value: 'COP', label: 'COP' },
  { value: 'BS', label: 'Bs' },
  { value: 'USD', label: 'USD' },
];

function getMethodCurrency(method: PaymentMethod): PaymentCurrency {
  if (method === 'POS' || method === 'MOBILE_PAYMENT' || method === 'BOLIVARES') {
    return 'BS';
  }

  if (method === 'USD' || method === 'ZELLE') {
    return 'USD';
  }

  return 'COP';
}

function defaultsToCashRegister(method: PaymentMethod) {
  return !['POS', 'MOBILE_PAYMENT', 'ZELLE', 'BANCOLOMBIA'].includes(method);
}

function formatCurrency(currency: PaymentCurrency, amount: number) {
  const prefix = currency === 'USD' ? 'USD' : currency === 'BS' ? 'Bs' : 'COP';
  return `${prefix} ${formatCompactNumber(amount)}`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getCopEquivalent(
  amount: number,
  currency: PaymentCurrency,
  exchangeRates: CashPreview['exchangeRates'],
) {
  if (currency === 'COP') {
    return amount;
  }

  if (currency === 'BS') {
    return amount * exchangeRates.copToBsDivisor;
  }

  return amount * exchangeRates.copToUsdDivisor;
}

function getPreviewAmountByCurrency(preview: CashPreview, currency: PaymentCurrency) {
  if (currency === 'COP') {
    return preview.total;
  }

  if (currency === 'BS') {
    return preview.conversions.bs;
  }

  return preview.conversions.usd;
}

export function CashPanel({
  tables,
  onCloseTable,
  onPreviewTable,
  onPrintInvoice,
  onLoadActiveCashSession,
  onOpenCashSession,
  onCloseCashSession,
  onCalculateCashChange,
}: Props) {
  const occupied = tables.filter((t) => ['OCCUPIED', 'RESERVED', 'BILLING'].includes(t.status));
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('CASH_COP');
  const [preview, setPreview] = useState<CashPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<CashSessionSummary | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const openingDraft = loadOpeningBalancesDraft();
  const [openingCop, setOpeningCop] = useState(openingDraft.cop);
  const [openingBs, setOpeningBs] = useState(openingDraft.bs);
  const [openingUsd, setOpeningUsd] = useState(openingDraft.usd);
  const [openingNote, setOpeningNote] = useState('');
  const [openingBusy, setOpeningBusy] = useState(false);
  const [showCloseSessionModal, setShowCloseSessionModal] = useState(false);
  const [closingBusy, setClosingBusy] = useState(false);
  const [countedCop, setCountedCop] = useState('');
  const [countedBs, setCountedBs] = useState('');
  const [countedUsd, setCountedUsd] = useState('');
  const [closingNote, setClosingNote] = useState('');

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [tenderedCurrency, setTenderedCurrency] = useState<PaymentCurrency>('COP');
  const [changeCurrency, setChangeCurrency] = useState<PaymentCurrency>('COP');
  const [paymentNote, setPaymentNote] = useState('');
  const [isTransferPayment, setIsTransferPayment] = useState(false);
  const [changeQuote, setChangeQuote] = useState<CashChangeQuote | null>(null);
  const [changeError, setChangeError] = useState<string>('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const tenderedInputRef = useRef<HTMLInputElement | null>(null);

  const selectedMethodLabel = useMemo(
    () => PAYMENT_OPTIONS.find((option) => option.method === selectedMethod)?.label || selectedMethod,
    [selectedMethod],
  );
  const latestMovement = useMemo(
    () => (activeSession?.movements.length ? activeSession.movements[activeSession.movements.length - 1] : null),
    [activeSession],
  );
  const totalSalesCount = useMemo(
    () =>
      activeSession
        ? Object.values(activeSession.salesByCurrency).reduce((acc, current) => acc + current.count, 0)
        : 0,
    [activeSession],
  );
  const openingBalancesSummary = useMemo(() => {
    if (!activeSession) {
      return null;
    }

    const openingBalances = activeSession.movements.reduce(
      (acc, movement) => {
        if (movement.type === 'OPENING') {
          acc[movement.currency] += movement.amount;
        }
        return acc;
      },
      { COP: 0, BS: 0, USD: 0 } as Record<PaymentCurrency, number>,
    );

    return `COP ${formatCompactNumber(openingBalances.COP)} | Bs ${formatCompactNumber(openingBalances.BS)} | USD ${formatCompactNumber(openingBalances.USD)}`;
  }, [activeSession]);
  const previewDisplayCurrency = showPaymentModal ? tenderedCurrency : getMethodCurrency(selectedMethod);
  const previewDisplayTotal = preview
    ? getPreviewAmountByCurrency(preview, previewDisplayCurrency)
    : 0;

  const getPaymentErrorMessage = (rawMessage: string, parsedAmount?: number) => {
    if (!preview) {
      return 'No se pudo calcular el vuelto.';
    }

    if (!parsedAmount || Number.isNaN(parsedAmount)) {
      return 'El monto recibido es obligatorio.';
    }

    if (parsedAmount < 0) {
      return 'El monto recibido no puede ser menor que cero.';
    }

    const normalized = rawMessage.toLowerCase();
    if (
      normalized.includes('tendered amount is lower than the total due') ||
      normalized.includes('lower than the total due') ||
      normalized.includes('insufficient')
    ) {
      const tenderedCop = getCopEquivalent(parsedAmount, tenderedCurrency, preview.exchangeRates);
      const missingAmount = Math.max(preview.total - tenderedCop, 0);
      return `El monto recibido no cubre el total. Faltan COP ${formatCompactNumber(missingAmount)}.`;
    }

    return 'No se pudo calcular el vuelto. Revisa el monto recibido y vuelve a intentarlo.';
  };

  const loadCashSession = async () => {
    setSessionLoading(true);
    try {
      const session = await onLoadActiveCashSession();
      setActiveSession(session);
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    void loadCashSession();
  }, []);

  useEffect(() => {
    if (activeSession) {
      return;
    }

    const draft = loadOpeningBalancesDraft();
    setOpeningCop(draft.cop);
    setOpeningBs(draft.bs);
    setOpeningUsd(draft.usd);
  }, [activeSession]);

  useEffect(() => {
    const methodCurrency = getMethodCurrency(selectedMethod);
    setTenderedCurrency(methodCurrency);
    setChangeCurrency(methodCurrency);
    setIsTransferPayment(!defaultsToCashRegister(selectedMethod));
  }, [selectedMethod]);

  useEffect(() => {
    if (!showPaymentModal || !preview) {
      return;
    }

    const parsedAmount = Number(tenderedAmount);
    if (!tenderedAmount) {
      setChangeQuote(null);
      setChangeError('El monto recibido es obligatorio.');
      return;
    }

    if (Number.isNaN(parsedAmount)) {
      setChangeQuote(null);
      setChangeError('Ingresa un monto valido.');
      return;
    }

    if (parsedAmount < 0) {
      setChangeQuote(null);
      setChangeError('El monto recibido no puede ser menor que cero.');
      return;
    }

    if (parsedAmount === 0) {
      setChangeQuote(null);
      setChangeError('El monto recibido debe ser mayor que cero.');
      return;
    }

    let cancelled = false;
    setQuoteLoading(true);
    setChangeError('');

    void onCalculateCashChange({
      totalAmount: preview.total,
      totalCurrency: 'COP',
      tenderedAmount: parsedAmount,
      tenderedCurrency,
      changeCurrency,
    })
      .then((quote) => {
        if (!cancelled) {
          setChangeQuote(quote);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setChangeQuote(null);
          setChangeError(
            getPaymentErrorMessage(error instanceof Error ? error.message : '', parsedAmount),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setQuoteLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showPaymentModal, preview, tenderedAmount, tenderedCurrency, changeCurrency, onCalculateCashChange]);

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

  const openPaymentModal = () => {
    const defaultCurrency = getMethodCurrency(selectedMethod);
    setTenderedCurrency(defaultCurrency);
    setChangeCurrency(defaultCurrency);
    setIsTransferPayment(!defaultsToCashRegister(selectedMethod));
    setTenderedAmount('');
    setPaymentNote('');
    setChangeQuote(null);
    setChangeError('');
    setShowPaymentModal(true);
  };

  const handleOpenSession = async () => {
    const parsedCop = Number(openingCop);
    const parsedBs = Number(openingBs);
    const parsedUsd = Number(openingUsd);

    if (
      Number.isNaN(parsedCop) ||
      Number.isNaN(parsedBs) ||
      Number.isNaN(parsedUsd) ||
      parsedCop < 0 ||
      parsedBs < 0 ||
      parsedUsd < 0
    ) {
      window.alert('Ingresa montos validos para abrir la caja.');
      return;
    }

    setOpeningBusy(true);
    try {
      const session = await onOpenCashSession({
        openingCop: parsedCop,
        openingBs: parsedBs,
        openingUsd: parsedUsd,
        openingNote: openingNote || undefined,
      });
      setActiveSession(session);
      saveOpeningBalancesDraft({ cop: parsedCop, bs: parsedBs, usd: parsedUsd });
      setOpeningNote('');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo abrir la caja.');
    } finally {
      setOpeningBusy(false);
    }
  };

  const openCloseSessionModal = () => {
    if (!activeSession) {
      return;
    }

    setCountedCop(String(activeSession.expectedBalances.COP.toFixed(2)));
    setCountedBs(String(activeSession.expectedBalances.BS.toFixed(2)));
    setCountedUsd(String(activeSession.expectedBalances.USD.toFixed(2)));
    setClosingNote('');
    setShowCloseSessionModal(true);
  };

  const confirmCloseSession = async () => {
    if (!activeSession) {
      return;
    }

    const parsedCop = Number(countedCop);
    const parsedBs = Number(countedBs);
    const parsedUsd = Number(countedUsd);

    if (
      Number.isNaN(parsedCop) ||
      Number.isNaN(parsedBs) ||
      Number.isNaN(parsedUsd) ||
      parsedCop < 0 ||
      parsedBs < 0 ||
      parsedUsd < 0
    ) {
      window.alert('Ingresa montos validos para el cierre de caja.');
      return;
    }

    setClosingBusy(true);
    try {
      await onCloseCashSession({
        sessionId: activeSession.session.id,
        countedCop: parsedCop,
        countedBs: parsedBs,
        countedUsd: parsedUsd,
        closingNote: closingNote || undefined,
      });
      saveOpeningBalancesDraft({ cop: parsedCop, bs: parsedBs, usd: parsedUsd });
      setActiveSession(null);
      setShowCloseSessionModal(false);
      setPreview(null);
      setSelectedTableId(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo cerrar la caja.');
    } finally {
      setClosingBusy(false);
    }
  };

  const confirmCloseTable = async () => {
    if (!selectedTableId) {
      return;
    }

    const parsedAmount = Number(tenderedAmount);
    if (!tenderedAmount) {
      setChangeError('El monto recibido es obligatorio.');
      tenderedInputRef.current?.focus();
      return;
    }

    if (Number.isNaN(parsedAmount)) {
      setChangeError('Ingresa un monto valido.');
      tenderedInputRef.current?.focus();
      return;
    }

    if (parsedAmount < 0) {
      setChangeError('El monto recibido no puede ser menor que cero.');
      tenderedInputRef.current?.focus();
      return;
    }

    if (parsedAmount === 0) {
      setChangeError('El monto recibido debe ser mayor que cero.');
      tenderedInputRef.current?.focus();
      return;
    }

    if (changeError || !changeQuote) {
      tenderedInputRef.current?.focus();
      return;
    }

    setPaymentBusy(true);
    try {
      await onCloseTable({
        tableId: selectedTableId,
        method: selectedMethod,
        tenderedAmount: parsedAmount,
        tenderedCurrency,
        changeCurrency,
        registerInCashSession: !isTransferPayment,
        note: paymentNote || undefined,
      });
      setPreview(null);
      setSelectedTableId(null);
      setShowPaymentModal(false);
      await loadCashSession();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo cerrar la cuenta.');
    } finally {
      setPaymentBusy(false);
    }
  };

  return (
    <section className="panel">
      <h3>Caja</h3>

      <section className="cash-session-card">
        <div className="cash-session-header">
          <div>
            <strong>Estado de caja</strong>
            <p>{sessionLoading ? 'Cargando...' : activeSession ? 'Caja abierta' : 'Caja cerrada'}</p>
          </div>
          {activeSession && (
            <div className="cash-session-header-actions">
              <div className="cash-session-pill">
                Abierta desde {new Date(activeSession.session.openedAt).toLocaleTimeString()}
              </div>
              <button type="button" className="danger-btn" onClick={openCloseSessionModal}>
                Cerrar caja
              </button>
            </div>
          )}
        </div>

        {activeSession && (
          <div className="cash-session-summary-grid">
            <article className="cash-session-summary-card">
              <strong>Fondo inicial</strong>
              <span>{openingBalancesSummary || 'Sin apertura registrada'}</span>
              <small>Valores confirmados al abrir la caja.</small>
            </article>
            <article className="cash-session-summary-card">
              <strong>Ventas registradas</strong>
              <span>{activeSession.paymentsCount}</span>
              <small>{totalSalesCount} movimientos de venta</small>
            </article>
            <article className="cash-session-summary-card">
              <strong>Ultimo movimiento</strong>
              <span>
                {latestMovement
                  ? formatCurrency(latestMovement.currency, latestMovement.amount)
                  : 'Sin movimientos'}
              </span>
              <small>
                {latestMovement
                  ? new Date(latestMovement.createdAt).toLocaleTimeString()
                  : 'Aun no hay actividad registrada'}
              </small>
            </article>
            <article className="cash-session-summary-card">
              <strong>Resumen operativo</strong>
              <span>{selectedTableId ? 'Cobro en curso' : 'Lista para cobrar'}</span>
              <small>Separo el estado de caja del flujo de cobro para reducir errores.</small>
            </article>
          </div>
        )}

        {activeSession ? (
          <>
            <div className="cash-session-balances">
              <article>
                <strong>COP esperado</strong>
                <span>{formatCurrency('COP', activeSession.expectedBalances.COP)}</span>
              </article>
              <article>
                <strong>Bs esperado</strong>
                <span>{formatCurrency('BS', activeSession.expectedBalances.BS)}</span>
              </article>
              <article>
                <strong>USD esperado</strong>
                <span>{formatCurrency('USD', activeSession.expectedBalances.USD)}</span>
              </article>
            </div>

            <div className="cash-session-balances">
              <article>
                <strong>Ventas COP</strong>
                <span>{formatCurrency('COP', activeSession.salesByCurrency.COP.total)}</span>
              </article>
              <article>
                <strong>Ventas Bs</strong>
                <span>{formatCurrency('BS', activeSession.salesByCurrency.BS.total)}</span>
              </article>
              <article>
                <strong>Ventas USD</strong>
                <span>{formatCurrency('USD', activeSession.salesByCurrency.USD.total)}</span>
              </article>
            </div>
          </>
        ) : (
          <>
            <p className="cash-session-open-help">
              Los montos se cargan con los valores guardados del ultimo cierre. Revísalos y confirma con abrir caja.
            </p>
            <div className="cash-session-open-form">
              <label>
                Fondo inicial COP
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingCop}
                  onChange={(event) => setOpeningCop(event.target.value)}
                />
              </label>
              <label>
                Fondo inicial Bs
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingBs}
                  onChange={(event) => setOpeningBs(event.target.value)}
                />
              </label>
              <label>
                Fondo inicial USD
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingUsd}
                  onChange={(event) => setOpeningUsd(event.target.value)}
                />
              </label>
              <label>
                Nota
                <input value={openingNote} onChange={(event) => setOpeningNote(event.target.value)} />
              </label>
              <button type="button" onClick={handleOpenSession} disabled={openingBusy}>
                {openingBusy ? 'Abriendo...' : 'Abrir caja'}
              </button>
            </div>
          </>
        )}
      </section>

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
          <div className="cash-preview-hero">
            <article className="cash-preview-total-card">
              <span>Total a cobrar</span>
              <strong>{formatCurrency(previewDisplayCurrency, previewDisplayTotal)}</strong>
              <small>
                Cobro actual en {previewDisplayCurrency} segun el metodo seleccionado
              </small>
            </article>
            <article className="cash-preview-summary-card">
              <span>Subtotal</span>
              <strong>{formatCurrency('COP', preview.subtotal)}</strong>
            </article>
            <article className="cash-preview-summary-card">
              <span>Impuestos</span>
              <strong>{formatCurrency('COP', preview.tax)}</strong>
            </article>
          </div>
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
                  <td>${formatCompactNumber(item.unitPrice)}</td>
                  <td>${formatCompactNumber(item.lineTotal)}</td>
                  <td className="cash-note">{item.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="cash-totals">
            <p>Total: ${formatCompactNumber(preview.total)}</p>
            <p>Total Bs: {formatCompactNumber(preview.conversions.bs)}</p>
            <p>Total USD: {formatCompactNumber(preview.conversions.usd)}</p>
          </div>

          <div className="cash-conversion-grid">
            <article><strong>COP</strong><span>${formatCompactNumber(preview.conversions.cop)}</span></article>
            <article><strong>Bs</strong><span>{formatCompactNumber(preview.conversions.bs)}</span></article>
            <article><strong>USD</strong><span>{formatCompactNumber(preview.conversions.usd)}</span></article>
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

          <div className="cash-actions cash-actions-grid">
            <button
              type="button"
              onClick={async () => {
                if (!selectedTableId) {
                  return;
                }
                try {
                  await onPrintInvoice(selectedTableId);
                  window.alert('Factura enviada a la impresora.');
                } catch (error) {
                  window.alert('No se pudo imprimir la factura: ' + (error as Error).message);
                }
              }}
            >
              Imprimir factura (backend)
            </button>
            <button type="button" onClick={() => preview && printPreviewInBrowser(preview)}>
              Imprimir navegador
            </button>
            <button type="button" onClick={openPaymentModal} disabled={!activeSession}>
              Cerrar cuenta
            </button>
            {!activeSession && <p className="cash-warning">Abre caja antes de cerrar una cuenta.</p>}
          </div>
        </section>
      )}

      <ModalConfirm
        open={showPaymentModal}
        title="Cobro y vuelto"
        confirmLabel={paymentBusy ? 'Procesando...' : 'Confirmar cobro'}
        cancelLabel="Cancelar"
        onConfirm={confirmCloseTable}
        onCancel={() => setShowPaymentModal(false)}
      >
        <div className="cash-payment-modal">
          <p>
            Metodo seleccionado: <strong>{selectedMethodLabel}</strong>
          </p>
          <div className="cash-payment-hero">
            <article className="cash-payment-hero-card highlight">
              <span>Total</span>
              <strong>{preview ? formatCurrency(tenderedCurrency, getPreviewAmountByCurrency(preview, tenderedCurrency)) : '--'}</strong>
            </article>
            <article className="cash-payment-hero-card">
              <span>Recibido</span>
              <strong>
                {tenderedAmount && !Number.isNaN(Number(tenderedAmount))
                  ? formatCurrency(tenderedCurrency, Number(tenderedAmount))
                  : '--'}
              </strong>
            </article>
            <article className="cash-payment-hero-card success">
              <span>Vuelto</span>
              <strong>
                {changeQuote
                  ? formatCurrency(
                      changeQuote.change.deliverInCurrency.currency,
                      changeQuote.change.deliverInCurrency.amount,
                    )
                  : '--'}
              </strong>
            </article>
          </div>

          <div className="cash-payment-form-grid">
            <label className="cash-amount-field">
              <span className="cash-amount-label">
                Monto recibido
                <button
                  type="button"
                  className="cash-inline-action"
                  onClick={() =>
                    setTenderedAmount(
                      String(
                        preview
                          ? getPreviewAmountByCurrency(preview, tenderedCurrency)
                          : 0,
                      ),
                    )
                  }
                >
                  Exacto
                </button>
              </span>
              <input
                ref={tenderedInputRef}
                type="number"
                min="0"
                step="0.01"
                value={tenderedAmount}
                className={changeError ? 'input-error' : undefined}
                onChange={(event) => {
                  setTenderedAmount(event.target.value);
                  if (changeError) {
                    setChangeError('');
                  }
                }}
              />
            </label>
            <label>
              Moneda del pago
              <select
                value={tenderedCurrency}
                onChange={(event) => setTenderedCurrency(event.target.value as PaymentCurrency)}
              >
                {CURRENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Entregar vuelto en
              <select
                value={changeCurrency}
                onChange={(event) => setChangeCurrency(event.target.value as PaymentCurrency)}
              >
                {CURRENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="cash-payment-note">
              Observacion
              <input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} />
            </label>
          </div>

          <label className="cash-toggle">
            <input
              type="checkbox"
              checked={isTransferPayment}
              onChange={(event) => setIsTransferPayment(event.target.checked)}
            />
            <span>Registrar como transferencia o pago no efectivo</span>
          </label>

          <div className="cash-feedback-slot">
            {changeError ? <span className="field-error">{changeError}</span> : null}
          </div>

          {/* <div className="cash-quick-amounts">
            <button type="button" onClick={() => setTenderedAmount(String(preview?.total || 0))}>
              Monto exacto
            </button>
            <button type="button" onClick={() => setTenderedAmount(String((preview?.total || 0) + 10000))}>
              +10.000
            </button>
            <button type="button" onClick={() => setTenderedAmount(String((preview?.total || 0) + 20000))}>
              +20.000
            </button>
            <button type="button" onClick={() => setTenderedAmount(String((preview?.total || 0) + 50000))}>
              +50.000
            </button>
          </div> */}

          <div className="cash-change-slot">
            {/* {quoteLoading ? <p className="cash-change-loading">Calculando vuelto...</p> : null} */}
            {changeQuote && (
              <div className="cash-change-summary">
                <article>
                  <strong>Total equivalente</strong>
                  <span>COP {formatCompactNumber(changeQuote.total.copEquivalent)}</span>
                </article>
                <article>
                  <strong>Recibido equivalente</strong>
                  <span>COP {formatCompactNumber(changeQuote.tendered.copEquivalent)}</span>
                </article>
                <article>
                  <strong>Vuelto en moneda de pago</strong>
                  <span>{formatCurrency(changeQuote.change.dueInTenderedCurrency.currency, changeQuote.change.dueInTenderedCurrency.amount)}</span>
                </article>
                <article>
                  <strong>Vuelto a entregar</strong>
                  <span>{formatCurrency(changeQuote.change.deliverInCurrency.currency, changeQuote.change.deliverInCurrency.amount)}</span>
                </article>
              </div>
            )}
          </div>
        </div>
      </ModalConfirm>

      <ModalConfirm
        open={showCloseSessionModal}
        title="Cierre de caja"
        confirmLabel={closingBusy ? 'Cerrando...' : 'Confirmar cierre'}
        cancelLabel="Cancelar"
        onConfirm={confirmCloseSession}
        onCancel={() => !closingBusy && setShowCloseSessionModal(false)}
      >
        <div className="cash-payment-modal">
          <p>
            Registra lo que realmente queda en caja al finalizar el dia.
          </p>
          <div className="cash-change-summary">
            <article>
              <strong>Esperado COP</strong>
              <span>{formatCurrency('COP', activeSession?.expectedBalances.COP || 0)}</span>
            </article>
            <article>
              <strong>Esperado Bs</strong>
              <span>{formatCurrency('BS', activeSession?.expectedBalances.BS || 0)}</span>
            </article>
            <article>
              <strong>Esperado USD</strong>
              <span>{formatCurrency('USD', activeSession?.expectedBalances.USD || 0)}</span>
            </article>
          </div>

          <div className="cash-payment-form-grid">
            <label>
              Contado COP
              <input
                type="number"
                min="0"
                step="0.01"
                value={countedCop}
                onChange={(event) => setCountedCop(event.target.value)}
              />
            </label>
            <label>
              Contado Bs
              <input
                type="number"
                min="0"
                step="0.01"
                value={countedBs}
                onChange={(event) => setCountedBs(event.target.value)}
              />
            </label>
            <label>
              Contado USD
              <input
                type="number"
                min="0"
                step="0.01"
                value={countedUsd}
                onChange={(event) => setCountedUsd(event.target.value)}
              />
            </label>
            <label className="cash-payment-note">
              Observacion de cierre
              <input value={closingNote} onChange={(event) => setClosingNote(event.target.value)} />
            </label>
          </div>
        </div>
      </ModalConfirm>
    </section>
  );
}
