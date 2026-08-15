/* ============================================================
   RENDER_VIDEO — graba la app GYM.OS en un video en bucle.
   Usa Chromium headless (Playwright) para capturar la página con
   TODAS sus animaciones (matrix, glitch, neón) y ffmpeg para
   recortar el arranque y normalizar.

   Uso:  node wallpaper/render_video.js
   Env:  GYM_VIDEO_OUT       salida (default wallpaper/gym-wallpaper.webm)
         GYM_WALLPAPER_URL   página (default http://localhost:8787)
         GYM_VIDEO_SECONDS   duración grabada (default 18)
   ============================================================ */

import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const OUT = process.env.GYM_VIDEO_OUT || path.join(process.cwd(), 'wallpaper', 'gym-wallpaper.webm')
const URL = process.env.GYM_WALLPAPER_URL || 'http://localhost:8787'
const SECONDS = Number(process.env.GYM_VIDEO_SECONDS || 18)
const TRIM = 1.5 // recortar los primeros segundos de carga

const TMP = fs.mkdtempSync('/tmp/gym-video-')

function log(msg) {
  console.log(`[render] ${msg}`)
}

async function main() {
  log(`grabando ${URL} durante ${SECONDS}s (${TMP})`)

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: TMP, size: { width: 1920, height: 1080 } },
  })

  const page = await context.newPage()
  await page.goto(URL, { waitUntil: 'networkidle' })
  // Asegura que la lluvia Matrix tenga contenido antes de grabar frames útiles
  await page.waitForTimeout(2500)
  await page.waitForTimeout(SECONDS * 1000)

  // Cierra el context para finalizar y escribir el .webm
  await context.close()
  await browser.close()

  const raw = fs
    .readdirSync(TMP)
    .map((f) => path.join(TMP, f))
    .find((f) => f.endsWith('.webm'))
  if (!raw) throw new Error('no se generó el video')

  log(`recorte de ${raw} -> ${OUT}`)
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  execFileSync('ffmpeg', [
    '-y',
    '-i', raw,
    '-t', String(SECONDS - TRIM),
    '-c:v', 'libvpx-vp9',
    '-crf', '32',
    '-b:v', '0',
    '-an',
    OUT,
  ], { stdio: 'inherit' })

  fs.rmSync(TMP, { recursive: true, force: true })
  log(`listo: ${OUT}`)
}

main().catch((err) => {
  console.error('[render] ERROR:', err.message)
  process.exit(1)
})
