import { io, Socket } from 'socket.io-client';
import { getSocketUrl } from '../runtimeConfig';

let socket: Socket | null = null;

export function connectSocket() {
  const url = getSocketUrl();
  socket = io(`${url}/pos`);
  return socket;
}

export function getSocket() {
  return socket;
}
