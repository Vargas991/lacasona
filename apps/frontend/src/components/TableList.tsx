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
}

export function TableList({ tables, onSelect }: Props) {
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
            <div className="table-list-boxes">
              {zoneTables.map((table) => (
                <div
                  key={table.id}
                  className={`table-list-card status-${table.status.toLowerCase()}`}
                >
                  <button className="table-select-btn" onClick={() => onSelect(table)}>
                    <strong>{table.name}</strong>
                    <span>{TABLE_STATUS_LABEL[table.status] || table.status}</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
