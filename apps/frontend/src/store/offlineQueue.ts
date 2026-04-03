const QUEUE_KEY = 'lacasona.offline.queue';

type QueueItem = {
  path: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
};

export function enqueueRequest(item: QueueItem) {
  const queue = readQueue();
  queue.push(item);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function readQueue(): QueueItem[] {
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as QueueItem[];
  } catch {
    return [];
  }
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}
