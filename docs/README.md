# Template Printer Documentation

Welcome to the Template Printer documentation. This application allows you to manage SVG templates, maintain a user database, and export ID cards with automatic field mapping.

## Documentation Index

1. [SVG Layer Naming & Auto-Mapping](./svg-layer-naming.md) - Learn how to name SVG layers for automatic field mapping
2. [SVG Template Usage](./svg-templates.md) - Guide to creating and using SVG templates
3. [User Database Fields](./user-database.md) - Complete reference of all supported user fields
4. [Reference Templates](./reference-templates/README.md) - Sample Illustrator exports, and what they exercise in the importer

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

## Card production reference

- **Size**: ISO/IEC 7810 ID-1 — 85.6 × 53.98 mm, 3.18 mm corner radius.
- **Magnetic stripe**: ISO/IEC 7811-2 puts the three tracks at 5.54–8.00,
  8.46–10.92 and 11.38–13.84 mm from the top edge of the back. The default
  stripe here is 12.7 mm (half-inch) tape 4 mm from that edge, which covers all
  three. Card printers vary; check against yours before a production run.
- **Punch**: a lanyard slot is typically 12 × 3 mm and a round hole ⌀5 mm, set
  3 mm in from the edge. Never punch through a magnetic stripe — punch an end or
  the bottom instead.
- **Bleed and trim**: artwork for card printing is usually drawn larger than the
  card, with a trim line marking the cut. **Card Area** is where you say which
  rectangle is the card and at what physical size; it is offered when a trim line
  is detected and never applied on its own. Getting this wrong is the most common
  reason cards print at the wrong size.

**New Blank** generates any of this as a starting template. **Mag Stripe**,
**Punch** and **Safe Area** draw the same geometry over an existing design as
overlays, without changing the file. **Lanyard** hangs the card from its punch so
you can see how it sits when worn.

**Test Cards** runs the open template against the records that break ID cards —
very short and very long names, missing middle names, accents, apostrophes,
identifiers a barcode cannot encode — and reports what overflowed, what had to be
shrunk, and what failed to encode.
