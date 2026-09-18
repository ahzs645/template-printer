declare module 'bwip-js' {
  interface BwipOptions {
    /** Encoder id, e.g. 'code128', 'rationalizedCodabar', 'qrcode'. */
    bcid: string
    text: string
    scale?: number
    height?: number
    width?: number
    includetext?: boolean
    textxalign?: string
    /** Bar colour as a bare RRGGBB hex string. */
    barcolor?: string
    backgroundcolor?: string
    textcolor?: string
    [key: string]: unknown
  }

  function toCanvas(canvas: HTMLCanvasElement, options: BwipOptions): Promise<HTMLCanvasElement>

  /** Render to standalone SVG markup. Synchronous; throws on invalid input. */
  function toSVG(options: BwipOptions): string

  export { toCanvas, toSVG }
  export default { toCanvas, toSVG }
}
