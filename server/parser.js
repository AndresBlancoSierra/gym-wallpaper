/* ============================================================
   PARSER — Lee las notas de Obsidian del gym
   Fuente de verdad: /home/andres/Documents/obsidian/Me/GYM

   Formato de cada ejercicio (Push/Pull/Leg/*.md):
     | Peso (kg) | 1 set | 2 set | 3 set |
     | --------- | ----- | ----- | ----- |
     | 12        | 12    | 12    | 12    |   <- una fila = una sesión
   - "//"     => celda vacía (se ignora)
   - "Banda"  => peso no numérico (banda elástica / peso corporal)

   Peso.md:
     | Fecha | Peso |
     | ----- | ---- |
     | 2026-08-03 | 75.5 |
   ============================================================ */

import fs from 'node:fs'
import path from 'node:path'

export const GYM_DIR =
  process.env.GYM_DIR || '/home/andres/Documents/obsidian/Me/GYM'

export const ME_DIR =
  process.env.ME_DIR || '/home/andres/Documents/obsidian/Me'

export const GROUPS = ['Push', 'Pull', 'Leg']

/* Convierte un valor de celda en: number | 'band' | null */
function parseCell(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (s === '' || s === '//' || s === '---' || s === '—') return null
  if (/^banda$/i.test(s)) return 'band'
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/* Extrae las filas de una tabla markdown. */
function parseTable(content) {
  const rows = []
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('|')) continue
    const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
    if (cells.length < 2) continue

    const first = cells[0] || ''
    if (/peso/i.test(first) && /set/i.test(cells[1] || '')) continue // cabecera
    if (/^[-_—]+$/.test(first) && /^[-_—]+$/.test(cells[1] || '')) continue // separador

    const weight = parseCell(cells[0])
    const sets = cells.slice(1).map(parseCell)
    const reps = sets.filter((v) => typeof v === 'number')

    // Fila sin información útil (todo vacío) => se descarta
    if (reps.length === 0) continue
    rows.push({ weight, sets, reps })
  }
  return rows
}

/* Analiza un ejercicio a partir de su archivo .md */
export function parseExercise(filePath) {
  const name = path.basename(filePath, '.md')
  const content = fs.readFileSync(filePath, 'utf8')
  return { name, file: filePath, rows: parseTable(content) }
}

/* Analiza Peso.md -> lista de { date, weight } ordenada.
   Soporta dos formatos:
     | Fecha | Peso |   (2 columnas, fecha real)
     | Peso  |        (1 columna, solo el peso; se usa una fecha
       | 60.00 |        sintética para mantener el orden)
*/
export function parseWeight(filePath) {
  const entries = []
  if (!fs.existsSync(filePath)) return entries
  const content = fs.readFileSync(filePath, 'utf8')
  let seq = 0
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('|')) continue
    const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
    if (cells.length === 0) continue
    const isHeader = cells.some((c) => /peso|fecha|^[-_—]+$|^\s*$/i.test(c))
    if (isHeader) continue
    let date = null
    let w = NaN
    if (cells.length >= 2 && /^\d{4}-\d{2}-\d{2}/.test(cells[0])) {
      date = cells[0]
      w = Number(cells[1].replace(',', '.'))
    } else if (cells.length === 1) {
      w = Number(cells[0].replace(',', '.'))
    }
    if (!Number.isFinite(w)) continue
    if (!date) date = synthDate(seq)
    entries.push({ date, weight: w })
    seq++
  }
  entries.sort((a, b) => a.date.localeCompare(b.date))
  return entries
}

/* Fecha sintética (año 2000) para filas de peso sin fecha: mantiene el orden */
function synthDate(i) {
  const d = new Date(Date.UTC(2000, 0, 1 + i))
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/* Lista los archivos .md de un grupo */
export function listExercises(groupDir) {
  if (!fs.existsSync(groupDir)) return []
  return fs
    .readdirSync(groupDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(groupDir, f))
    .sort()
}

/* Cuenta los checkboxes marcados ([x]) de un archivo (p.ej. volley.md) */
export function parseChecklist(filePath) {
  if (!fs.existsSync(filePath)) return { hasData: false, count: 0 }
  const content = fs.readFileSync(filePath, 'utf8')
  let count = 0
  for (const line of content.split('\n')) {
    if (/-\s*\[x\]/i.test(line)) count++
  }
  return { hasData: true, count }
}

/* Contador de días de gimnasio (~/.local/state/counter, vía alias si/no) */
export function parseCounter(filePath) {
  if (!fs.existsSync(filePath)) return { hasData: false, days: 0 }
  const raw = fs.readFileSync(filePath, 'utf8').trim()
  const n = Number(raw)
  return { hasData: Number.isFinite(n), days: Number.isFinite(n) ? n : 0 }
}
