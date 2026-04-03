import { OrderItem } from '../types';

function keyByUser(userId: string) {
  return `lacasona.orderDrafts.${userId}`;
}

export function loadOrderDrafts(userId: string): Record<string, OrderItem[]> {
  const raw = localStorage.getItem(keyByUser(userId));
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, OrderItem[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveOrderDrafts(userId: string, drafts: Record<string, OrderItem[]>) {
  localStorage.setItem(keyByUser(userId), JSON.stringify(drafts));
}

export function clearOrderDrafts(userId: string) {
  localStorage.removeItem(keyByUser(userId));
}
