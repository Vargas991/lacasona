# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-04-03

### Added
- POS base for restaurant operations with roles for admin, waiter, and kitchen.
- Active order flow with table assignment, kitchen board, cash closing, and order history.
- Product and category management, including packaging category support.
- Dashboard with period filters and Excel export.
- Payment support for COP, bolivars flows, USD, and Zelle.
- PWA support via vite-plugin-pwa with generated manifest and service worker.
- Offline queue support for write actions and reconnect sync attempt.
- Floor-plan style table layout with zone and coordinate persistence.
- Drag-and-drop table positioning in the floor layout.
- Move-table action relocated to a modal in the order panel.

### Changed
- UI labels translated to Spanish across the main navigation and status displays.
- History and dashboard payment displays updated to use persisted payment currency snapshots.
- Table cards compacted for better density in the layout board.

### Fixed
- Table account closing now records payment entries per open order to avoid missing payment records.
- History date filters normalized for local timezone handling.
- Unauthorized API responses now force session clear and return to login flow.
- Cash preview and billing summary logic constrained to current table cycle to avoid mixed historical rows.
