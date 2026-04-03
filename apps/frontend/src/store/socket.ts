import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket() {
  const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
  socket = io(`${url}/pos`);
  return socket;
}

export function getSocket() {
  return socket;
}
