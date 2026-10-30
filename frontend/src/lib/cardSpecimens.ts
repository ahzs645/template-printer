/**
 * The bundled university card specimens (Design → Card Designer).
 *
 * Imported as assets rather than fetched from public/, so they resolve from
 * wherever the printer is served: its own site, or a host app that builds the
 * printer from source.
 */
const SPECIMENS = import.meta.glob<string>('../assets/card-specimens/*-specimen.template-printer.zip', {
  query: '?url',
  import: 'default',
  eager: true,
})

export function cardSpecimenUrl(kind: string): string {
  const url = SPECIMENS[`../assets/card-specimens/${kind}-specimen.template-printer.zip`]
  if (!url) throw new Error(`There is no bundled ${kind} specimen.`)
  return url
}
