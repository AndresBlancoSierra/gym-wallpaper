/* ============================================================
   SERVIDOR — Express, solo lectura.
   - GET /api/stats  → JSON con stats + gamificación
   - sirve el build de la UI (../dist) en producción
   Actualización: el navegador hace poll cada 2s; el servidor
   cachea el parseo comparando los mtime de los .md.
   ============================================================ */

import express from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeStats } from './stats.js'
import { GYM_DIR, ME_DIR } from './parser.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 8787
const DIST = path.join(__dirname, '..', 'dist')

const app = express()
let cache = { key: '', data: null }

/* Huella de los .md: ruta + mtime. Si cambia => recalcular. */
function gymKey() {
  const out = []
  const dirs = [GYM_DIR, ME_DIR]
  for (const dir of dirs) {
    const walk = (d) => {
      if (!fs.existsSync(d)) return
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f)
        let st
        try {
          st = fs.statSync(p)
        } catch {
          continue
        }
        if (st.isDirectory()) walk(p)
        else if (f.endsWith('.md')) out.push(`${p}:${st.mtimeMs}`)
      }
    }
    walk(dir)
  }
  const counterFile = path.join(os.homedir(), '.local', 'state', 'counter')
  if (fs.existsSync(counterFile)) {
    try {
      out.push(`${counterFile}:${fs.statSync(counterFile).mtimeMs}`)
    } catch {
      /* ignore */
    }
  }
  return out.sort().join('|')
}

app.get('/api/stats', (_req, res) => {
  const key = gymKey()
  if (key !== cache.key) cache = { key, data: computeStats() }
  res.json(cache.data)
})

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`[gym-wallpaper] API + UI en http://localhost:${PORT}`)
  console.log(`[gym-wallpaper] Fuente: ${GYM_DIR}`)
})
