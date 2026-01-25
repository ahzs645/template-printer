declare module 'bwip-js' {
  interface BwipOptions {
    bcid: string
    text: string
    scale?: number
    height?: number
    width?: number
    includetext?: boolean
    textxalign?: string
    [key: string]: unknown
  }

  function toCanvas(canvas: HTMLCanvasElement, options: BwipOptions): Promise<HTMLCanvasElement>

  export { toCanvas }
  export default { toCanvas }
}
