import { useState } from 'react';
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

export function DashboardCards({ stats, filters, onLoadStats, onSaveExchangeRates }: Props) {
  if (!stats) {
    return <section className="panel">Sin datos de dashboard</section>;
  }

  const [copToBsDivisor, setCopToBsDivisor] = useState(String(stats.exchangeRates.copToBsDivisor));
  const [copToUsdDivisor, setCopToUsdDivisor] = useState(
    String(stats.exchangeRates.copToUsdDivisor),
  );
  const [saving, setSaving] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [exporting, setExporting] = useState(false);

  const groupedPayments = Object.values(
    stats.paymentsByMethod.reduce<
      Record<string, { key: string; label: string; count: number; total: number }>
    >((acc, item) => {
      const groupKey =
        item.method === 'CASH' || item.method === 'CASH_COP'
          ? 'COP'
          : item.method === 'BOLIVARES' || item.method === 'POS' || item.method === 'MOBILE_PAYMENT'
            ? 'BS'
            : item.method;

      const labelMap: Record<string, string> = {
        COP: 'COP',
        BS: 'Bolivares (POS / Pago movil)',
        CARD: 'Tarjeta',
        USD: 'Dolares',
        ZELLE: 'Zelle',
      };

      if (!acc[groupKey]) {
        acc[groupKey] = {
          key: groupKey,
          label: labelMap[groupKey] || groupKey,
          count: 0,
          total: 0,
        };
      }

      acc[groupKey].count += item.count;
      acc[groupKey].total += item.total;
      return acc;
    }, {}),
  )
    .filter((item) => item.count > 0 || item.total > 0)
    .sort((a, b) => b.total - a.total);

  const formatGroupedPaymentTotal = (groupKey: string, amount: number) => {
    if (groupKey === 'BS') {
      return `Bs ${amount.toFixed(2)}`;
    }

    if (groupKey === 'USD' || groupKey === 'ZELLE') {
      return `USD ${amount.toFixed(2)}`;
    }

    return `COP ${amount.toFixed(2)}`;
  };

  const periodRevenue = stats.revenuePeriod ?? stats.revenueToday;
  const periodTickets = stats.ticketsPeriod ?? stats.ticketsToday;

  const reportTotals = stats.salesReport.reduce(
    (acc, item) => {
      acc.quantity += item.quantity;
      acc.totalCop += item.totalCop;
      acc.totalBs += item.totalBs;
      acc.totalUsd += item.totalUsd;
      return acc;
    },
    { quantity: 0, totalCop: 0, totalBs: 0, totalUsd: 0 },
  );

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');

      const summaryRows = [
        { Campo: 'Desde', Valor: filters.from || '' },
        { Campo: 'Hasta', Valor: filters.to || '' },
        { Campo: 'Tickets periodo', Valor: periodTickets },
        { Campo: 'Ingresos periodo (COP)', Valor: Number(periodRevenue.toFixed(2)) },
      ];

      const paymentRows = groupedPayments.map((item) => ({
        Tipo: item.label,
        Pagos: item.count,
        Total: Number(item.total.toFixed(2)),
        Moneda: item.key === 'BS' ? 'BS' : item.key === 'USD' || item.key === 'ZELLE' ? 'USD' : 'COP',
      }));

      const salesRows = stats.salesReport.map((item) => ({
        Producto: item.productName,
        Categoria: item.categoryName,
        Cantidad: item.quantity,
        'Precio COP': Number(item.unitPrice.toFixed(2)),
        'Total COP': Number(item.totalCop.toFixed(2)),
        'Total Bs': Number(item.totalBs.toFixed(2)),
        'Total USD': Number(item.totalUsd.toFixed(2)),
      }));

      salesRows.push({
        Producto: 'TOTAL',
        Categoria: '-',
        Cantidad: reportTotals.quantity,
        'Precio COP': 0,
        'Total COP': Number(reportTotals.totalCop.toFixed(2)),
        'Total Bs': Number(reportTotals.totalBs.toFixed(2)),
        'Total USD': Number(reportTotals.totalUsd.toFixed(2)),
      });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Resumen');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(paymentRows), 'Pagos');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(salesRows), 'Productos');

      const stamp = new Date();
      const dateStamp = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, '0')}${String(
        stamp.getDate(),
      ).padStart(2, '0')}_${String(stamp.getHours()).padStart(2, '0')}${String(
        stamp.getMinutes(),
      ).padStart(2, '0')}`;
      XLSX.writeFile(workbook, `reporte_dashboard_${dateStamp}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="panel dashboard-panel">
      <section className="dashboard-section">
        <h3>Periodo del reporte</h3>
        <form
          className="dashboard-filters"
          onSubmit={async (event) => {
            event.preventDefault();
            setLoadingStats(true);
            try {
              await onLoadStats(filters);
            } finally {
              setLoadingStats(false);
            }
          }}
        >
          <div className="history-periods">
            <button
              type="button"
              onClick={async () => {
                setLoadingStats(true);
                try {
                  await onLoadStats(getPeriodRange('today'));
                } finally {
                  setLoadingStats(false);
                }
              }}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={async () => {
                setLoadingStats(true);
                try {
                  await onLoadStats(getPeriodRange('yesterday'));
                } finally {
                  setLoadingStats(false);
                }
              }}
            >
              Ayer
            </button>
            <button
              type="button"
              onClick={async () => {
                setLoadingStats(true);
                try {
                  await onLoadStats(getPeriodRange('last7'));
                } finally {
                  setLoadingStats(false);
                }
              }}
            >
              Ultimos 7 dias
            </button>
            <button
              type="button"
              onClick={async () => {
                setLoadingStats(true);
                try {
                  await onLoadStats(getPeriodRange('month'));
                } finally {
                  setLoadingStats(false);
                }
              }}
            >
              Mes actual
            </button>
          </div>

          <input
            type="date"
            value={filters.from || ''}
            onChange={(event) => {
              void onLoadStats({ ...filters, from: event.target.value || undefined });
            }}
          />
          <input
            type="date"
            value={filters.to || ''}
            onChange={(event) => {
              void onLoadStats({ ...filters, to: event.target.value || undefined });
            }}
          />
          <button type="submit" disabled={loadingStats}>
            {loadingStats ? 'Buscando...' : 'Aplicar'}
          </button>
          <button type="button" onClick={exportToExcel} disabled={exporting}>
            {exporting ? 'Exportando...' : 'Exportar Excel'}
          </button>
        </form>
      </section>

      <div className="stats-grid">
        <article><h4>Mesas libres</h4><p>{stats.tablesFree}</p></article>
        <article><h4>Mesas ocupadas</h4><p>{stats.tablesOccupied}</p></article>
        <article><h4>Pedidos activos</h4><p>{stats.activeOrders}</p></article>
        <article><h4>Ingresos periodo</h4><p>COP {periodRevenue.toFixed(2)}</p></article>
        <article><h4>Tickets periodo</h4><p>{periodTickets}</p></article>
      </div>

      <section className="dashboard-section">
        <h3>Tasas de cambio</h3>
        <form
          className="exchange-rate-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            try {
              await onSaveExchangeRates({
                copToBsDivisor: Number(copToBsDivisor),
                copToUsdDivisor: Number(copToUsdDivisor),
              });
            } finally {
              setSaving(false);
            }
          }}
        >
          <label>
            COP a Bs (divide)
            <input value={copToBsDivisor} onChange={(e) => setCopToBsDivisor(e.target.value)} />
          </label>
          <label>
            COP a USD (divide)
            <input value={copToUsdDivisor} onChange={(e) => setCopToUsdDivisor(e.target.value)} />
          </label>
          <button disabled={saving}>{saving ? 'Guardando...' : 'Guardar tasas'}</button>
        </form>
      </section>

      <section className="dashboard-section">
        <h3>Tipos de pago hoy</h3>
        <div className="payment-summary-grid">
          {groupedPayments.map((item) => (
            <article key={item.key}>
              <h4>{item.label}</h4>
              <p>{item.count} pagos</p>
              <strong>{formatGroupedPaymentTotal(item.key, item.total)}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <h3>Productos vendidos (periodo)</h3>
        <div className="sales-report-table-wrap">
          <table className="sales-report-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoria</th>
                <th>Cantidad</th>
                <th>Precio COP</th>
                <th>Total COP</th>
                <th>Total Bs</th>
                <th>Total USD</th>
              </tr>
            </thead>
            <tbody>
              {stats.salesReport.map((item) => (
                <tr key={item.productId}>
                  <td>{item.productName}</td>
                  <td>{item.categoryName}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unitPrice.toFixed(2)}</td>
                  <td>{item.totalCop.toFixed(2)}</td>
                  <td>{item.totalBs.toFixed(2)}</td>
                  <td>{item.totalUsd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>TOTAL</th>
                <th>-</th>
                <th>{reportTotals.quantity}</th>
                <th>-</th>
                <th>{reportTotals.totalCop.toFixed(2)}</th>
                <th>{reportTotals.totalBs.toFixed(2)}</th>
                <th>{reportTotals.totalUsd.toFixed(2)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </section>
  );
}
