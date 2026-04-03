import {
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'pos',
})
export class EventsGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  afterInit() {
    this.server.emit('system.ready', { message: 'POS gateway ready' });
  }

  emit(event: string, payload: unknown) {
    this.server.emit(event, payload);
  }
}
