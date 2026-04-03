import { Injectable } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Injectable()
export class EventsService {
  constructor(private readonly gateway: EventsGateway) {}

  publish(event: string, payload: unknown) {
    this.gateway.emit(event, payload);
  }
}
