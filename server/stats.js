/* ============================================================
   STATS — métricas de progreso + gamificación
   Progreso = PRIMERA fila vs ÚLTIMA fila de cada ejercicio.
   - Volumen (fuerza) = Σ(kg × reps). Si el peso no es numérico
     (banda / peso corporal) => volumen = Σ reps (flag band).
   ============================================================ */

import os from 'node:os'
import path from 'node:path'
import { GROUPS, GYM_DIR, ME_DIR, listExercises, parseExercise, parseChecklist, parseCounter, parseWeight } from './parser.js'

/* ---------- Volumen y métricas de una fila ---------- */
function analyzeRow(row) {
  const totalReps = row.reps.reduce((a, b) => a + b, 0)
  const maxSet = Math.max(...row.reps)
  if (typeof row.weight === 'number') {
    return {
      kg: row.weight,
      band: false,
      volume: row.weight * totalReps,
      reps: totalReps,
      maxSet,
    }
  }
  return { kg: null, band: true, volume: totalReps, reps: totalReps, maxSet }
}

const pct = (a, b) => (a > 0 ? ((b - a) / a) * 100 : null)

/* ---------- Análisis de un ejercicio ---------- */
function analyzeExercise(filePath) {
  const { name, rows } = parseExercise(filePath)
  const parsed = rows.map(analyzeRow)
  const hasData = parsed.length > 0
  if (!hasData) {
    return { name, hasData: false, rows: 0 }
  }

  const first = parsed[0]
  const last = parsed[parsed.length - 1]
  const prev = parsed.slice(0, -1)

  // PR: ¿la última fila supera el mejor de todas las anteriores?
  const prevMaxKg = Math.max(0, ...prev.filter((r) => r.kg != null).map((r) => r.kg))
  const prevMaxSet = Math.max(0, ...prev.map((r) => r.maxSet))
  const prKg = last.kg != null && last.kg > prevMaxKg
  const prReps = last.maxSet > prevMaxSet
  const pr = prKg || prReps
  const prLabel = prKg && prReps ? 'PR x2' : prKg ? 'PR PESO' : prReps ? 'PR REPS' : null

  return {
    name,
    hasData: true,
    rows: parsed.length,
    band: last.band,
    // volumen
    firstVolume: first.volume,
    lastVolume: last.volume,
    deltaPct: pct(first.volume, last.volume),
    // peso
    firstKg: first.kg,
    lastKg: last.kg,
    deltaKg: first.kg != null && last.kg != null ? last.kg - first.kg : null,
    maxKg: Math.max(0, ...parsed.filter((r) => r.kg != null).map((r) => r.kg)),
    maxReps: Math.max(...parsed.map((r) => r.maxSet)),
    lastReps: last.reps,
    lastMaxSet: last.maxSet,
    firstReps: first.reps,
    pr,
    prLabel,
    singleSession: parsed.length === 1,
  }
}

/* ---------- Análisis de un grupo (push/pull/leg) ---------- */
function analyzeGroup(name, groupDir) {
  const exercises = listExercises(groupDir).map(analyzeExercise)
  const withData = exercises.filter((e) => e.hasData)
  const firstVolume = withData.reduce((a, e) => a + e.firstVolume, 0)
  const lastVolume = withData.reduce((a, e) => a + e.lastVolume, 0)
  const deltaKg = withData.reduce((a, e) => a + (e.deltaKg ?? 0), 0)
  // Progreso del grupo = promedio del progreso (%) de cada ejercicio
  const pcts = withData.map((e) => e.deltaPct).filter((p) => p != null)
  const deltaPctAvg = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null
  return {
    name,
    key: name.toLowerCase(),
    hasData: withData.length > 0,
    firstVolume,
    lastVolume,
    deltaPct: pct(firstVolume, lastVolume),
    deltaPctAvg,
    deltaKg,
    exercises,
  }
}

/* ---------- Peso corporal ---------- */
function dateStr(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function calcStreak(entries) {
  const set = new Set(entries.map((e) => e.date))
  let d = new Date()
  if (!set.has(dateStr(d))) d = new Date(Date.now() - 86400000)
  let streak = 0
  while (set.has(dateStr(d))) {
    streak++
    d = new Date(d.getTime() - 86400000)
  }
  return streak
}

function analyzeWeight(entries) {
  const hasData = entries.length > 0
  const first = entries[0]?.weight ?? null
  const current = entries[entries.length - 1]?.weight ?? null
  return {
    hasData,
    current,
    first,
    delta: first != null && current != null ? current - first : null,
    deltaPct: first != null && current != null ? ((current - first) / first) * 100 : null,
    streak: calcStreak(entries),
    entries,
  }
}

/* ---------- Gamificación ---------- */
const XP_SESSION = 5
const XP_PROGRESS = 10
const XP_PR = 25
const XP_WEIGHT_TODAY = 5
const XP_STREAK = 10

function buildGamification(groups, weight) {
  const achievements = []
  let xp = 0
  let sessions = 0
  let exercisesDone = 0
  let exercisesTotal = 0

  for (const g of Object.values(groups)) {
    for (const e of g.exercises) {
      exercisesTotal++
      if (!e.hasData) continue
      sessions += e.rows
      exercisesDone++
      if (e.deltaPct > 0) {
        xp += XP_PROGRESS
        achievements.push(`Progresión en ${e.name} (+${e.deltaPct.toFixed(0)}%)`)
      }
      if (e.pr) {
        xp += XP_PR
        achievements.push(`${e.prLabel} en ${e.name}`)
      }
    }
    if (g.hasData && g.deltaPct > 20) {
      achievements.push(`Volumen de ${g.name} +${g.deltaPct.toFixed(0)}%`)
    }
  }

  xp += sessions * XP_SESSION
  if (sessions > 0) achievements.push('Primera sesión registrada')
  if (exercisesDone === exercisesTotal && exercisesTotal > 0)
    achievements.push('Todos los ejercicios con datos')

  const today = dateStr(new Date())
  const weighedToday = weight.entries.some((e) => e.date === today)
  if (weighedToday) xp += XP_WEIGHT_TODAY
  if (weight.hasData) achievements.push('Empezaste a registrarte en la báscula')
  if (weight.streak >= 3) {
    xp += XP_STREAK
    achievements.push(`Racha de ${weight.streak} días pesándote`)
  }
  if (xp === 0) achievements.push('Registra tu primera sesión para desbloquear XP')

  // Nivel: xpNecesario(n) = 50*n^2
  const level = Math.floor(Math.sqrt(xp / 50))
  const intoLevel = xp - 50 * level * level
  const toNext = 50 * (2 * level + 1)
  const progress = toNext > 0 ? intoLevel / toNext : 1

  const rank =
    level === 0
      ? 'SIN SEÑAL'
      : level <= 3
        ? 'Novato'
        : level <= 7
          ? 'Runner'
          : level <= 12
            ? 'Netrunner'
            : level <= 19
              ? 'Legendario'
              : 'Cyberpunk'

  return {
    xp,
    level,
    intoLevel,
    toNext,
    progress,
    rank,
    sessions,
    achievements: [...new Set(achievements)].slice(0, 12),
  }
}

/* ---------- API principal ---------- */
export function computeStats() {
  const groups = {}
  for (const g of GROUPS) {
    const groupDir = path.join(GYM_DIR, g)
    groups[g.toLowerCase()] = analyzeGroup(g, groupDir)
  }
  const weight = analyzeWeight(parseWeight(path.join(GYM_DIR, 'Peso.md')))
  const volley = parseChecklist(path.join(ME_DIR, 'volley.md'))
  const counter = parseCounter(path.join(os.homedir(), '.local', 'state', 'counter'))
  const gamification = buildGamification(groups, weight)
  return {
    updatedAt: new Date().toISOString(),
    source: GYM_DIR,
    groups,
    weight,
    volley,
    counter,
    gamification,
  }
}
