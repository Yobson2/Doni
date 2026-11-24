#!/usr/bin/env node
/**
 * JavaScript budget (ADR 0010): the gzipped size of the JS a first visit
 * loads, i.e. the entry chunk of index.html plus every chunk it imports
 * statically, must stay under a limit. Lazy route chunks are not counted,
 * except the one for the start page (`--include`), which a first visit loads.
 *
 * Reads Vite's build manifest (`build.manifest: true`).
 *
 *   node scripts/check-bundle-size.mjs [--dist dist] [--limit-kb 200]
 *
 * Exits 1 when the budget is exceeded.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

/**
 * JS files of the entry chunk(s) and of their static imports, plus the
 * chunks whose manifest key is listed in `include` (and their imports).
 */
export function firstLoadFiles(manifest, include = []) {
  const roots = Object.entries(manifest)
    .filter(([, c]) => c.isEntry)
    .map(([key]) => key)
  if (roots.length === 0) throw new Error('No entry chunk in the manifest')
  const seen = new Set()
  const files = []
  const visit = (key) => {
    if (seen.has(key)) return
    seen.add(key)
    const chunk = manifest[key]
    if (!chunk) return
    for (const imported of chunk.imports ?? []) visit(imported)
    if (chunk.file.endsWith('.js')) files.push(chunk.file)
  }
  for (const key of [...roots, ...include]) visit(key)
  return files
}

/** Measures first-load JS in `dist`: sizes in bytes and the verdict. */
export function checkBundle({ dist, limitKb, include = [] }) {
  const manifest = JSON.parse(
    readFileSync(path.join(dist, '.vite', 'manifest.json'), 'utf8')
  )
  const keys = include.flatMap((pattern) =>
    Object.keys(manifest).filter((key) => key.includes(pattern))
  )
  const files = firstLoadFiles(manifest, keys).map((file) => ({
    file,
    gzip: gzipSync(readFileSync(path.join(dist, file)), { level: 9 }).length,
  }))
  const total = files.reduce((sum, f) => sum + f.gzip, 0)
  const limit = limitKb * 1024
  return { files, total, limit, ok: total <= limit }
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const dist = path.resolve(arg('dist', path.join(here, '..', 'dist')))
  const limitKb = Number(arg('limit-kb', 200))
  const include = arg('include', '').split(',').filter(Boolean)
  const { files, total, limit, ok } = checkBundle({ dist, limitKb, include })
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`
  for (const f of files) console.log(`  ${kb(f.gzip).padStart(9)}  ${f.file}`)
  console.log(`First-load JS (gzip): ${kb(total)} / budget ${kb(limit)}`)
  if (!ok) {
    console.error(`Bundle budget exceeded by ${kb(total - limit)}`)
    process.exit(1)
  }
}
