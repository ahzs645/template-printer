# Embedding Template Printer

Template Printer is one React component, `TemplatePrinter`. The standalone app
(`frontend/src/main.tsx`) renders it across the whole page; another React app
can render the same component inline, in a box of its own, with no iframe.

It is consumed from source, the way [door-sign](https://github.com/ahzs645/door-sign)
is: nothing is published to npm.

## Install

```bash
git submodule add https://github.com/ahzs645/template-printer.git vendor/template-printer
cd vendor/template-printer/frontend && corepack pnpm install --frozen-lockfile
```

The printer's own dependencies (fabric, three, dexie, jszip, pdf-lib, Radix, …)
resolve from `vendor/template-printer/frontend/node_modules`, so the host does
not install them. The host needs React 19 (`react`, `react-dom`), Vite with
`@vitejs/plugin-react`, and Tailwind CSS v4 through `@tailwindcss/vite`.

## Vite config

```js
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Required: one React for the host and the printer. Without it the
    // printer's files load React from its own node_modules and hooks fail.
    dedupe: ['react', 'react-dom'],
  },
})
```

Nothing else: the printer imports no `@/` alias and reads no `import.meta.env`
variable when embedded, and Vite's dependency scan finds its packages. If the
submodule sits outside the Vite root, add it to `server.fs.allow`.

## Use

```jsx
import { TemplatePrinter } from './vendor/template-printer/frontend/src/embed'
import './vendor/template-printer/frontend/src/embed/template-printer.css'

export function Printer({ packageBytes }) {
  return (
    // The printer fills its parent: give the parent a size.
    <div style={{ height: '80vh' }}>
      <TemplatePrinter
        initialPackage={packageBytes}
        packageLabel="Brandkit"
        onExportPackage={(bytes, filename) => importIntoBrand(bytes, filename)}
      />
    </div>
  )
}
```

| Prop | Default | Meaning |
| --- | --- | --- |
| `initialPackage` | | A template package ZIP (`Uint8Array`, `ArrayBuffer` or `Blob`) to open. Opened again whenever a different object is passed; a package this browser already opened is reselected, not imported twice. |
| `packageLabel` | `'the host app'` | Who sent the package, in messages such as *Opened "Staff card" from Brandkit.* |
| `packageUrl` | | A package to open by URL: http(s), relative to the page, or a `blob:` URL. |
| `storage` | `'local'` | `'local'` (IndexedDB in the browser), `'api'` (the Express backend at `/api/*` on the page's origin) or `'convex'` (with `convexUrl`). |
| `convexUrl` | | The Convex deployment, for `storage="convex"`. |
| `syncUrl` | `false` | Only for a page that is all printer (the standalone app): read and clear `?url=` and `#share/` links, build share links from the page address, put the theme class on `<html>` and take key presses anywhere on the page. Embedded, the printer never reads or rewrites the host's address. |
| `shareUrl` | | The address of a standalone Template Printer for *Share → link*. Without it an embedded printer offers the package download only. |
| `onExportPackage` | | Called with `(bytes, filename)` whenever the user downloads a package (*Share → Download package*, and the designer's *Download editable package*). The browser download still happens. |
| `initialTab` | `'users'` | `'users'`, `'design'`, `'export'`, `'calibration'` or `'settings'`. Opening a package switches to `'design'`. |
| `onTabChange` | | Called with the new tab. |
| `theme` | the user's choice | `'light'` or `'dark'`, if the host decides. |
| `className`, `style` | | For the root element, which always has the class `template-printer`. |

## Styles

`template-printer.css` must be compiled by Tailwind v4 (`@tailwindcss/vite`).
It scans only the printer's own sources, wherever it is compiled from, and
every rule it emits is scoped:

- The root element is `.template-printer`; dialogs and dropdown lists render
  into `div.template-printer-portal`, which the component appends to
  `document.body` while it is mounted. Both carry the theme (`.dark`).
- Tailwind's preflight applies inside those two elements only. No rule targets
  `html`, `body` or `:root`, and no Tailwind variables are defined on `:root`.
- The rules are unlayered and include the root class, so a host's own element
  rules (`h2 {}`, `button {}`) do not restyle the printer, and the printer's
  rules do not reach the host's elements.
- Layout breakpoints are container queries on the root, so a narrow box gets
  the phone layout on a wide screen (it works down to 375 px).

Remaining global effects, which CSS cannot scope: Tailwind's `@property`
registrations for its `--tw-*` variables (plus their fallback, which sets those
variables on every element in browsers without `@property`), and
`@keyframes spin`. Sizes are in `rem`, so they follow the host's root font size.

## What the component does to the page

- Appends one `div.template-printer-portal` to `document.body` while mounted.
- Adds a capturing `pointerdown` listener on `document` (to know whether the
  last click was inside the printer) and, in the card designer, a `keydown`
  listener on `window`. Shortcuts (undo, redo, duplicate, Delete/Backspace)
  only act when the key press comes from inside the printer, or from the bare
  page right after a click inside it.
- Registers the fonts a template uses with `document.fonts`, which is global.
- Uses the origin's IndexedDB (`local` storage) and a few `localStorage` keys
  (`template-printer.theme`, `template-printer.opened-packages`, and the export
  and lanyard preferences).
- Appends a temporary `<a download>` to `document.body` for each download.

Render one printer per page: storage that code outside React reads is
module-wide.
