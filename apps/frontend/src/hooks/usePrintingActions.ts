import { api } from '../api';
import {
  InvoiceTicketPreview,
  KitchenTicketPreview,
  OrderReceiptPreview,
  PrintJobResult,
} from '../types';

export function usePrintingActions(token?: string) {
  const getInvoicePreview = async (tableId: string): Promise<InvoiceTicketPreview> => {
    if (!token) {
      throw new Error('No token');
    }

    return api<InvoiceTicketPreview>(`/printing/invoice/${tableId}`, 'GET', token);
  };

  const printKitchenTicket = async (orderId: string): Promise<void> => {
    if (!token) {
      throw new Error('No token');
    }

    await api<PrintJobResult>(`/printing/kitchen-ticket/${orderId}/print`, 'POST', token);
  };

  const reprintKitchenTicket = async (orderId: string): Promise<KitchenTicketPreview | null> => {
    if (!token) {
      return null;
    }

    try {
      return await api<KitchenTicketPreview>(`/printing/kitchen-ticket/${orderId}`, 'GET', token);
    } catch {
      return null;
    }
  };

  const printInvoice = async (tableId: string): Promise<void> => {
    if (!token) {
      throw new Error('No token');
    }

    const preview = await getInvoicePreview(tableId);

    if (!preview?.escpos) {
      throw new Error('Nothing to print');
    }

    await api<PrintJobResult>(`/printing/invoice/${tableId}/print`, 'POST', token);
  };

  const getOrderReceiptPreview = async (orderId: string): Promise<OrderReceiptPreview> => {
    if (!token) {
      throw new Error('No token');
    }

    return api<OrderReceiptPreview>(`/printing/receipt/${orderId}`, 'GET', token);
  };

  const printOrderReceipt = async (orderId: string): Promise<void> => {
    if (!token) {
      throw new Error('No token');
    }

    const preview = await getOrderReceiptPreview(orderId);

    if (!preview?.escpos) {
      throw new Error('Nothing to print');
    }

    await api<PrintJobResult>(`/printing/receipt/${orderId}/print`, 'POST', token);
  };

  return {
    getInvoicePreview,
    printKitchenTicket,
    reprintKitchenTicket,
    printInvoice,
    getOrderReceiptPreview,
    printOrderReceipt,
  };
}
