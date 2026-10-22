# Compliance Tracker

Multi-tenant compliance tracker for Indian tax, statutory and IT/security obligations.

- **Stack:** React (Vite) + Node/Express + SQLite (`node:sqlite`, Node 22.13+)
- **Organisations & roles:** each signup creates an organisation; admins manage team and clients, members work tasks
- **Catalog:** GST, TDS/TCS, Income Tax, ROC, PF/ESI/PT, FEMA, ISO 27001 / SOC 2 / DPDP items, generated per client per financial year
- **Features:** compliance calendar, status and assignees, evidence upload (10 MB/file), dashboard with compliance score, CSV export

## Run

```bash
npm run install:all
npm run build
JWT_SECRET=change-me npm start      # http://localhost:3000
```

Development: `npm --prefix server run dev` and `npm --prefix client run dev` (Vite proxies `/api`).
Data lives in `server/data/` (override with `DATA_DIR`). Tests: `npm test`.

## Notes

Due dates in the catalog are statutory defaults; extensions notified by CBDT/CBIC/MCA must be edited on the task.
Reminders are in-app (dashboard "Needs attention"); email/WhatsApp delivery is not built yet.
