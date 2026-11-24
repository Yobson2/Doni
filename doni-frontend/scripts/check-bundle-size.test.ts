import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// @ts-expect-error: plain JavaScript run by node in CI, no type declarations.
import { checkBundle, firstLoadFiles } from './check-bundle-size.mjs'

const script = path.join(__dirname, 'check-bundle-size.mjs')

/** Incompressible bytes, so the gzipped size is about the raw size. */
const noise = (kb: number) => randomBytes(kb * 1024)

describe('bundle budget check', () => {
  let dist: string

  // A build: an entry with one static import, a lazy route, and the start
  // page's route chunk.
  beforeAll(() => {
    dist = mkdtempSync(path.join(tmpdir(), 'doni-budget-'))
    mkdirSync(path.join(dist, '.vite'))
    mkdirSync(path.join(dist, 'assets'))
    const files = {
      'assets/index.js': 30,
      'assets/vendor.js': 20,
      'assets/lazy.js': 500,
      'assets/home.js': 10,
    }
    for (const [file, kb] of Object.entries(files)) {
      writeFileSync(path.join(dist, file), noise(kb))
    }
    const manifest = {
      'index.html': {
        file: 'assets/index.js',
        isEntry: true,
        imports: ['_vendor.js'],
        dynamicImports: ['src/routes/admin.tsx', 'src/routes/home.tsx'],
      },
      '_vendor.js': { file: 'assets/vendor.js' },
      'src/routes/admin.tsx': { file: 'assets/lazy.js', isDynamicEntry: true },
      'src/routes/home.tsx': {
        file: 'assets/home.js',
        isDynamicEntry: true,
        imports: ['_vendor.js'],
      },
    }
    writeFileSync(
      path.join(dist, '.vite', 'manifest.json'),
      JSON.stringify(manifest)
    )
  })

  afterAll(() => rmSync(dist, { recursive: true, force: true }))

  it('counts the entry, its static imports and the start page, not lazy routes', () => {
    const manifest = {
      'index.html': { file: 'a.js', isEntry: true, imports: ['_b'] },
      _b: { file: 'b.js' },
      'src/routes/admin.tsx': { file: 'lazy.js' },
    }
    expect(firstLoadFiles(manifest)).toEqual(['b.js', 'a.js'])
  })

  it('passes under the limit', () => {
    const result = checkBundle({
      dist,
      limitKb: 200,
      include: ['src/routes/home.tsx'],
    })
    expect(result.files.map((f: { file: string }) => f.file)).toEqual([
      'assets/vendor.js',
      'assets/index.js',
      'assets/home.js',
    ])
    expect(result.ok).toBe(true)
  })

  it('fails the CI step (exit code 1) when the budget is exceeded', () => {
    const run = (limitKb: number) =>
      execFileSync(
        process.execPath,
        [script, '--dist', dist, '--limit-kb', String(limitKb)],
        { encoding: 'utf8', stdio: 'pipe' }
      )

    expect(run(200)).toContain('First-load JS (gzip)')
    let failure: { status?: number; stderr?: string } = {}
    try {
      run(40) // about 50 KB first-load: over a deliberately low limit
    } catch (error) {
      failure = error as typeof failure
    }
    expect(failure.status).toBe(1)
    expect(failure.stderr).toContain('Bundle budget exceeded')
  })
})
