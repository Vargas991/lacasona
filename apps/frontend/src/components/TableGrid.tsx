import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { RestaurantTable } from '../types';

const TABLE_STATUS_LABEL: Record<string, string> = {
  FREE: 'Libre',
  OCCUPIED: 'Ocupada',
  RESERVED: 'Reservada',
  BILLING: 'En caja',
  DISABLED: 'Deshabilitada',
};

interface Props {
  tables: RestaurantTable[];
  onSelect: (table: RestaurantTable) => void;
  canEditLayout?: boolean;
  onUpdateLayout?: (tableId: string, payload: { zone?: string; layoutX?: number; layoutY?: number }) => Promise<void>;
}

export function TableGrid({
  tables,
  onSelect,
  canEditLayout = false,
  onUpdateLayout,
}: Props) {
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const boardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({});

  const visibleTables = tables.filter((table) => table.status !== 'DISABLED');
  const groupedByZone = visibleTables.reduce<Record<string, RestaurantTable[]>>((acc, table) => {
    const zoneKey = (table.zone || 'Salon').trim() || 'Salon';
    if (!acc[zoneKey]) {
      acc[zoneKey] = [];
    }
    acc[zoneKey].push(table);
    return acc;
  }, {});

  const zones = Object.entries(groupedByZone).sort(([a], [b]) => a.localeCompare(b));

  useEffect(() => {
    const next = tables.reduce<Record<string, { x: number; y: number }>>((acc, table) => {
      acc[table.id] = {
        x: table.layoutX ?? 50,
        y: table.layoutY ?? 50,
      };
      return acc;
    }, {});

    setPositions(next);
    positionsRef.current = next;
  }, [tables]);

  const clampPercent = (value: number) => Math.max(6, Math.min(94, value));

  const updateDraggedPosition = (tableId: string, zoneName: string, clientX: number, clientY: number) => {
    const board = boardRefs.current[zoneName];
    if (!board) {
      return;
    }

    const rect = board.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const x = clampPercent(((clientX - rect.left) / rect.width) * 100);
    const y = clampPercent(((clientY - rect.top) / rect.height) * 100);

    setPositions((current) => {
      const next = {
        ...current,
        [tableId]: { x, y },
      };
      positionsRef.current = next;
      return next;
    });
  };

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, table: RestaurantTable, zoneName: string) => {
    if (!canEditLayout || !onUpdateLayout) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    setDraggingTableId(table.id);
    updateDraggedPosition(table.id, zoneName, event.clientX, event.clientY);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      updateDraggedPosition(table.id, zoneName, moveEvent.clientX, moveEvent.clientY);
    };

    const handlePointerUp = async (upEvent: PointerEvent) => {
      upEvent.preventDefault();
      updateDraggedPosition(table.id, zoneName, upEvent.clientX, upEvent.clientY);

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      setDraggingTableId(null);

      const finalPos = positionsRef.current[table.id];
      if (!finalPos) {
        return;
      }

      try {
        await onUpdateLayout(table.id, {
          zone: table.zone || 'Salon',
          layoutX: Math.round(finalPos.x),
          layoutY: Math.round(finalPos.y),
        });
      } catch {
        // If persisting fails, parent data reload will restore canonical coordinates.
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp, { passive: false });
  };

  return (
    <section className="panel">
      <h3>Mesas</h3>
      <div className="table-zones">
        {zones.map(([zoneName, zoneTables]) => (
          <section key={zoneName} className="table-zone">
            <header className="table-zone-header">
              <strong>{zoneName}</strong>
              <small>{zoneTables.length} mesas</small>
            </header>

            <div
              className="table-layout-board"
              ref={(element) => {
                boardRefs.current[zoneName] = element;
              }}
            >
              {zoneTables.map((table) => (
                <article
                  key={table.id}
                  className={`table-card status-${table.status.toLowerCase()}${draggingTableId === table.id ? ' is-dragging' : ''}`}
                  style={{
                    left: `${positions[table.id]?.x ?? table.layoutX ?? 50}%`,
                    top: `${positions[table.id]?.y ?? table.layoutY ?? 50}%`,
                  }}
                >
                  {canEditLayout && onUpdateLayout && (
                    <button
                      type="button"
                      className="table-card-drag-handle"
                      onPointerDown={(event) => startDrag(event, table, zoneName)}
                      title="Arrastra para ubicar mesa"
                    >
                      Arrastrar
                    </button>
                  )}

                  <button className="table-select-btn" onClick={() => onSelect(table)}>
                    <strong>{table.name}</strong>
                    <span>{TABLE_STATUS_LABEL[table.status] || table.status}</span>
                    <small>{table.capacity} personas</small>
                  </button>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
