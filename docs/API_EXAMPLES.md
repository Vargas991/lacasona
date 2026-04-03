# API Examples

## Auth

POST /auth/login

```json
{
  "email": "admin@lacasona.local",
  "password": "Admin123*"
}
```

## Tables

GET /tables
Authorization: Bearer <token>

POST /tables

```json
{
  "name": "M10",
  "capacity": 6
}
```

PATCH /tables/:id/status

```json
{
  "status": "OCCUPIED"
}
```

## Products

GET /products

POST /products

```json
{
  "name": "Taco Pastor",
  "price": 85
}
```

## Orders

POST /orders

```json
{
  "tableId": "<tableId>",
  "waiterId": "<waiterId>",
  "items": [
    {
      "productId": "<productId>",
      "quantity": 2,
      "note": "Sin cebolla"
    }
  ]
}
```

PATCH /orders/:id/status

```json
{
  "status": "PREPARING"
}
```

GET /kitchen/board

## Cash

POST /cash/close-table

```json
{
  "tableId": "<tableId>",
  "cashierId": "<userId>",
  "method": "CASH"
}
```

## Printing

GET /printing/kitchen-ticket/:orderId

GET /printing/invoice/:tableId

## Dashboard

GET /dashboard/stats
