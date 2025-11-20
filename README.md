# Template Printer

Full-stack tool for managing ID card SVG templates, editing fields, and exporting preview PDFs.

## Development

1. Install dependencies
   - Backend: `cd backend && pnpm install`
   - Frontend: `cd frontend && pnpm install`
2. Start the backend API: `pnpm dev` inside `backend/` (defaults to port 3000).
3. Start the Vite frontend: `pnpm dev` inside `frontend/` (defaults to port 5173).
   - The dev server proxies `/api` and `/templates` to the backend, so ensure the backend is running first.
4. Lint the frontend: `pnpm lint` inside `frontend/`.

## Docker

Build the full application (backend + compiled frontend) into a single container:

```bash
docker build -t template-printer .
docker run -p 3000:3000 template-printer
```

The container serves the compiled React app and API from Express on port 3000.

When using `docker compose` (or Komodo), set `PUBLIC_PORT` to a value >= 1024 (3200 by default) because rootless Docker daemons cannot publish privileged ports. The application inside the container still listens on `PORT`.

## Project Layout

- `backend/` – Express API, SQLite database, and static asset hosting.
- `frontend/` – React application for template management and previewing.
- `Dockerfile` – Multi-stage build that compiles the frontend and prepares the backend runtime.
