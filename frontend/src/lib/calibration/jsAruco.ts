// js-aruco2 publishes two scripts that attach CV and AR to `this`, not a module. Vite 7's
// CommonJS interop happens to give them an exports object as `this`; Vite 8's bundler rewrites a
// top-level `this` to undefined, so a host building the printer with it (brandkit) gets nothing.
// Running the sources here, with an object of our own as `this`, works under every bundler.
import cvSource from 'js-aruco2/src/cv.js?raw'
import arucoSource from 'js-aruco2/src/aruco.js?raw'

type ArucoScope = { CV?: unknown; AR?: any }

const scope: ArucoScope = {}
const run = (source: string) => new Function('require', source).call(scope, (path: string) => (path === './cv' ? scope : {}))
run(cvSource)
run(arucoSource)

export const AR = scope.AR
