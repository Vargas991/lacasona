# La Casona POS

Aplicacion base completa para restaurante con:

- Frontend: React + Vite
- Backend: NestJS
- Base de datos: PostgreSQL + Prisma
- Tiempo real: Socket.io
- Auth: JWT + roles
- Extras: dashboard, offline basico, PWA instalable

## Estructura

- apps/backend: API NestJS modular
- apps/backend/prisma/schema.prisma: modelo de datos
- apps/frontend: cliente React POS
- docs/API_EXAMPLES.md: ejemplos de endpoints
- docker-compose.yml: PostgreSQL local

## Modulos de negocio

- Gestion de mesas: CRUD + estados FREE/OCCUPIED/RESERVED/BILLING
- Comandas: creacion por mesa con multiples productos y notas
- KDS cocina: vista en tiempo real y cambio de estado
- Usuarios: roles ADMIN/WAITER/KITCHEN con JWT
- Caja: cierre de cuenta con CASH/CARD y calculo automatico
- Impresion: ticket cocina e invoice simple en formato compatible ESC/POS
- Dashboard: metricas basicas del dia

## Arranque rapido

1. Copiar variables:
   - cp .env.example .env
   - cp apps/backend/.env.example apps/backend/.env

2. Levantar PostgreSQL:
   - docker compose up -d

3. Instalar dependencias:
   - npm install

4. Generar Prisma y migrar:
   - npm run prisma:generate
   - npm run prisma:migrate -- --name init

5. Semilla inicial:
   - npm --workspace apps/backend exec ts-node prisma/seed.ts

6. Ejecutar backend:
   - npm run dev:backend

7. Ejecutar frontend:
   - npm run dev:frontend

## Credenciales seed

- admin@lacasona.local / Admin123*
- mesero@lacasona.local / Mesero123*
- cocina@lacasona.local / Cocina123*

## WebSocket

Namespace: /pos

Eventos emitidos:
- order.created
- order.status.changed
- table.status.changed
- cash.closed

## Notas de arquitectura

- Estructura modular por dominio en NestJS
- DTOs con class-validator
- Guards para autenticacion y autorizacion
- Servicios desacoplados con EventsService para sincronizacion realtime
- Frontend dividido por componentes POS principales
- Cola offline basica en localStorage para acciones mutables

## Estado actual

- Build backend: OK
- Build frontend: OK
