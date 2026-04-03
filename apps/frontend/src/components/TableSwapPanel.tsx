import { FormEvent, useState } from 'react';
import { RestaurantTable } from '../types';

interface Props {
  tables: RestaurantTable[];
  onSwap: (fromTableId: string, toTableId: string) => Promise<void>;
}

export function TableSwapPanel({ tables, onSwap }: Props) {
  const [fromTableId, setFromTableId] = useState('');
  const [toTableId, setToTableId] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!fromTableId || !toTableId || fromTableId === toTableId) {
      return;
    }

    setBusy(true);
    try {
      await onSwap(fromTableId, toTableId);
      setFromTableId('');
      setToTableId('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel swap-panel">
      <h3>Intercambiar Mesas</h3>
      <form className="swap-form" onSubmit={handleSubmit}>
        <select value={fromTableId} onChange={(e) => setFromTableId(e.target.value)}>
          <option value="">Mesa origen</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.name}
            </option>
          ))}
        </select>

        <select value={toTableId} onChange={(e) => setToTableId(e.target.value)}>
          <option value="">Mesa destino</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.name}
            </option>
          ))}
        </select>

        <button disabled={busy}>{busy ? 'Aplicando...' : 'Intercambiar'}</button>
      </form>
    </section>
  );
}
