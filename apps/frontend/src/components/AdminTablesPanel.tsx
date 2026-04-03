import { FormEvent, useState } from 'react';
import { RestaurantTable, TableStatus } from '../types';

interface Props {
  tables: RestaurantTable[];
  onCreateTable: (name: string, capacity: number, zone?: string) => Promise<void>;
  onRenameTable: (tableId: string, name: string) => Promise<void>;
  onUpdateLayout: (tableId: string, payload: { zone?: string; layoutX?: number; layoutY?: number }) => Promise<void>;
  onChangeStatus: (tableId: string, status: TableStatus) => Promise<void>;
  onDeleteTable: (tableId: string) => Promise<void>;
}

const STATUS_OPTIONS: TableStatus[] = ['FREE', 'OCCUPIED', 'RESERVED', 'BILLING', 'DISABLED'];

const STATUS_LABEL: Record<TableStatus, string> = {
  FREE: 'Libre',
  OCCUPIED: 'Ocupada',
  RESERVED: 'Reservada',
  BILLING: 'En caja',
  DISABLED: 'Deshabilitada',
};

export function AdminTablesPanel({
  tables,
  onCreateTable,
  onRenameTable,
  onUpdateLayout,
  onChangeStatus,
  onDeleteTable,
}: Props) {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [zone, setZone] = useState('Salon');
  const [busy, setBusy] = useState(false);
  const [layoutDrafts, setLayoutDrafts] = useState<Record<string, { zone: string; layoutX: string; layoutY: string }>>({});

  const getLayoutDraft = (table: RestaurantTable) => {
    const existing = layoutDrafts[table.id];
    if (existing) {
      return existing;
    }

    return {
      zone: table.zone || 'Salon',
      layoutX: String(table.layoutX ?? 50),
      layoutY: String(table.layoutY ?? 50),
    };
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    setBusy(true);
    try {
      await onCreateTable(name.trim(), capacity, zone.trim() || 'Salon');
      setName('');
      setCapacity(4);
      setZone('Salon');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel admin-tables">
      <h3>Administrar Mesas</h3>

      <form className="admin-table-form" onSubmit={handleCreate}>
        <input
          placeholder="Nombre mesa (ej. M10)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          min={1}
          max={30}
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value || 1))}
        />
        <input
          placeholder="Zona (ej. Salon, Terraza)"
          value={zone}
          onChange={(e) => setZone(e.target.value)}
        />
        <button disabled={busy}>{busy ? 'Guardando...' : 'Agregar mesa'}</button>
      </form>

      <div className="admin-table-list">
        {tables.map((table) => (
          <article key={table.id} className="admin-table-item">
            <div>
              <strong>{table.name}</strong>
              <small>{table.capacity} personas</small>
            </div>
            <div className="admin-table-actions">
              <select
                value={table.status}
                onChange={(e) => onChangeStatus(table.id, e.target.value as TableStatus)}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={async () => {
                  const nextName = window.prompt('Nuevo nombre de mesa', table.name);
                  if (!nextName || !nextName.trim() || nextName.trim() === table.name) {
                    return;
                  }
                  await onRenameTable(table.id, nextName.trim());
                }}
              >
                Renombrar
              </button>
              <button
                className="danger-btn"
                onClick={() => {
                  const ok = window.confirm(`Deshabilitar ${table.name}?`);
                  if (ok) {
                    onDeleteTable(table.id);
                  }
                }}
              >
                Deshabilitar
              </button>
            </div>
            <div className="admin-table-layout-controls">
              <input
                placeholder="Zona"
                value={getLayoutDraft(table).zone}
                onChange={(event) =>
                  setLayoutDrafts((current) => ({
                    ...current,
                    [table.id]: {
                      ...getLayoutDraft(table),
                      zone: event.target.value,
                    },
                  }))
                }
              />
              <input
                type="number"
                min={0}
                max={100}
                value={getLayoutDraft(table).layoutX}
                onChange={(event) =>
                  setLayoutDrafts((current) => ({
                    ...current,
                    [table.id]: {
                      ...getLayoutDraft(table),
                      layoutX: event.target.value,
                    },
                  }))
                }
              />
              <input
                type="number"
                min={0}
                max={100}
                value={getLayoutDraft(table).layoutY}
                onChange={(event) =>
                  setLayoutDrafts((current) => ({
                    ...current,
                    [table.id]: {
                      ...getLayoutDraft(table),
                      layoutY: event.target.value,
                    },
                  }))
                }
              />
              <button
                type="button"
                onClick={async () => {
                  const draft = getLayoutDraft(table);
                  const nextX = Math.min(100, Math.max(0, Number(draft.layoutX || 0)));
                  const nextY = Math.min(100, Math.max(0, Number(draft.layoutY || 0)));
                  await onUpdateLayout(table.id, {
                    zone: draft.zone.trim() || 'Salon',
                    layoutX: Number.isFinite(nextX) ? nextX : 50,
                    layoutY: Number.isFinite(nextY) ? nextY : 50,
                  });
                }}
              >
                Guardar ubicacion
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
