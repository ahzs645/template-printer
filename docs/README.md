# Template Printer Documentation

Welcome to the Template Printer documentation. This application allows you to manage SVG templates, maintain a user database, and export ID cards with automatic field mapping.

## Documentation Index

1. [SVG Layer Naming & Auto-Mapping](./svg-layer-naming.md) - Learn how to name SVG layers for automatic field mapping
2. [SVG Template Usage](./svg-templates.md) - Guide to creating and using SVG templates
3. [User Database Fields](./user-database.md) - Complete reference of all supported user fields

## Quick Start

### Development

1. Install dependencies:
   ```bash
   cd backend && pnpm install
   cd ../frontend && pnpm install
   ```

2. Start the backend (port 3000):
   ```bash
   cd backend && pnpm dev
   ```

3. Start the frontend (port 5173):
   ```bash
   cd frontend && pnpm dev
   ```

### Docker

Run the entire application with Docker:

```bash
docker build -t template-printer .
docker run -p 3000:3000 template-printer
```

Or use Docker Compose:

```bash
docker-compose up
```

## Key Features

- **Template Management**: Upload and manage SVG templates for ID cards
- **User Database**: Store user information with support for 17+ fields
- **Auto-Mapping**: Automatically map SVG layers to user fields based on layer names
- **Batch Export**: Export multiple ID cards in a single PDF
- **Custom Fields**: Support for custom static text fields
- **Font Management**: Upload and embed custom fonts in exported PDFs

## Architecture

- **Backend**: Node.js + Express + SQLite
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Database**: SQLite with Better-SQLite3
- **PDF Export**: pdf-lib for PDF generation
