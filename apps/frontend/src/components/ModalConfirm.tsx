import React from 'react';

interface ModalConfirmProps {
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export function ModalConfirm({
  open,
  title = '¿Confirmar?',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  children,
}: ModalConfirmProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal">
        {title && <h4>{title}</h4>}
        {message && <p>{message}</p>}
        {children}
        <div className="modal-actions">
          <button className="" style={{minWidth: 100}} onClick={onConfirm}>{confirmLabel}</button>
          <button className="danger-btn" style={{minWidth: 100}} onClick={onCancel}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}
