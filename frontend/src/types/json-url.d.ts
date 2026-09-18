declare module 'json-url' {
  interface JsonUrlCodec {
    compress<T>(value: T): Promise<string>
    decompress<T>(compressed: string): Promise<T>
    stats<T>(value: T): Promise<{ rawencoded: number; compressedencoded: number; compression: number }>
  }

  function JsonUrl(algorithm: 'lzma' | 'lzw' | 'lzstring' | 'pack'): JsonUrlCodec

  export default JsonUrl
}
