import { NavLink } from 'react-router-dom';
import { UserRole } from '../types';

interface Props {
  role: UserRole;
}

export function AppNav({ role }: Props) {
  return (
    <nav className="tabs">
      <NavLink to="/sala">Sala</NavLink>
        {role === 'ADMIN' && (
          <>
            <NavLink to="/kds">Cocina</NavLink>
            <NavLink to="/caja">Caja</NavLink>
            <NavLink to="/historial">Historial</NavLink>
            <NavLink to="/menu">Menu</NavLink>
            <NavLink to="/dashboard">Reportes</NavLink>
          </>
        )}
    </nav>
  );
}
