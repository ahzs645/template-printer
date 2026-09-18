/**
 * Module resolution hook for running the app's TypeScript sources under Node.
 *
 * The sources are written for a bundler, so relative imports omit their file
 * extension. Node's ESM resolver requires one; this fills it in.
 */

import { extname } from 'node:path'

const EXTENSIONS = ['.ts', '.tsx']

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !extname(specifier)) {
    for (const extension of EXTENSIONS) {
      try {
        return await nextResolve(specifier + extension, context)
      } catch {
        // Try the next extension.
      }
    }
  }
  return nextResolve(specifier, context)
}
