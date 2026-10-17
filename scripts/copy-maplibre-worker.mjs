// MapLibre GL v6 is ESM-only and loads its worker from a separate module file,
// which the Next.js bundler does not emit. Serve it from public/ instead.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json"));
mkdirSync("public/vendor", { recursive: true });
copyFileSync(join(dist, "dist", "maplibre-gl-worker.mjs"), "public/vendor/maplibre-gl-worker.mjs");
