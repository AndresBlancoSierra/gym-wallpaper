<p align="center">
  <a href="https://github.com/AndresBlancoSierra/gym-wallpaper">
    <img src="https://raw.githubusercontent.com/AndresBlancoSierra/gym-wallpaper/main/profile.svg" alt="GYM.OS — gym-wallpaper@arch">
  </a>
</p>

# GYM.OS — Wallpaper cyberpunk que gamifica tu vida

Wallpaper **HTML animado real** para Hyprland que lee tus notas de gym en
Obsidian y las convierte en stats de juego: progresión de fuerza por grupo
(push/pull/leg), peso corporal con gráfico, XP, niveles y logros.

Se actualiza **solo** al editar los `.md` — sin tocar la interfaz.

---

## ✨ Qué ves

- **3 tarjetas grandes** (PUSH / PULL / LEG) con el **+X% de fuerza** comparando
  **tu primer día vs tu último día** de cada ejercicio.
- Por ejercicio: último peso × sets, flechas ▲/▼ de progreso y medallas `◆ PR`.
- Ejercicios con **banda/peso corporal** cuentan por **reps** (Dominadas).
- **Peso corporal**: peso actual, delta total, racha de días pesándote y un
  sparkline neón de la evolución.
- **Gamificación**: XP por sesión/progreso/PR, NIVEL (curva 50·n²), rango
  (Novato → Runner → Netrunner → Legendario → Cyberpunk) y logros en marquee.
- **Estética cyberpunk**: lluvia Matrix de fondo, scanlines CRT, neón, glitch,
  grid TRON, parpadeos — todos animados.
- **Reloj y estado** "SISTEMA EN LÍNEA" en vivo.

---

## 🧠 Cómo calcula las stats

Fuente: `/home/andres/Documents/obsidian/Me/GYM`

```
GYM/
├── Peso.md            → tabla  | Fecha | Peso |   (regístrate a diario)
├── Push/  *.md        → | Peso (kg) | 1 set | 2 set | 3 set |
├── Pull/  *.md
└── Leg/   *.md
```

- **Cada fila = una sesión**. Añadir una fila al final = registrar un día.
- `//` se ignora · `Banda`/texto en peso = cuenta por **reps**.
- **Fuerza** = volumen `Σ(kg × reps)`. Progreso = **última fila vs primera**.
- El servidor cachea por mtime y la UI consulta cada 2 s → al guardar en
  Obsidian, el wallpaper cambia casi al instante.

---

## 🚀 Puesta en marcha

### 1) Servidor + UI (una vez)

```bash
cd ~/Proyects/gym-wallpaper
npm install
npm run build          # UI estática en dist/
npm start              # Express: UI + GET /api/stats en :8787
```

Prueba rápida: abre `http://localhost:8787` en el navegador (F11 = fullscreen).

### 2) Wallpaper de verdad (detrás de todas las ventanas)

Requiere el plugin de Hyprland **`hyprwinwrap`** (envuelve una ventana normal
como fondo):

```bash
hyprpm add https://github.com/gen3vra/hyprwinwrap
hyprpm enable hyprwinwrap
```

Config ya añadida en `~/.config/hypr/hyprland.conf`:

```
windowrule = no_focus on, match:class (org.gym.wallpaper)
windowrule = no_initial_focus on, match:class (org.gym.wallpaper)

plugin {
    hyprwinwrap {
        class = org.gym.wallpaper
        title = GYM.OS
        pos_x = 0; pos_y = 0; size_x = 100; size_y = 100
    }
}
```

El wallpaper es la **app React cyberpunk** (matrix rain, glitch, neón, scanlines)
mostrada en una **ventana WebKitGTK** que `hyprwinwrap` coloca de fondo. El
orquestador `wallpaper.py` arranca el server si hace falta, lanza la ventana
WebKit (class `org.gym.wallpaper`) y la relanza si muere:

```bash
npm run wallpaper
```

> 🔎 **Nota importante**: si no ves el wallpaper, comprueba que no haya OTRO
> fondo encima (p. ej. widgets EWW con `:stacking "bottom"`, que son una capa
> `bottom` por encima del nivel `background` de hyprwinwrap y lo tapan).

### 3) Autostart (ya añadido en `~/.config/hypr/autostart.conf`)

- `exec-once = hyprpm reload` en `hyprland.conf` (carga el plugin al arrancar).
- `python3 wallpaper/wallpaper.py` 8 s después (arranca el server si hace falta
  y lanza la ventana WebKit; retry automático si el server no responde).

---

## 🗂️ Estructura

```
gym-wallpaper/
├── server/            # Node + Express (solo lectura)
│   ├── parser.js      # markdown de Obsidian → datos
│   ├── stats.js       # métricas + gamificación
│   └── index.js       # API /api/stats + sirve dist/
├── wallpaper/
│   ├── wallpaper.py   # orquestador: server + ventana WebKit (class org.gym.wallpaper)
│   ├── webkit.py      # ventana WebKitGTK que carga la app HTML
│   ├── tui.py         # (fallback) dashboard ANSI en foot, no usado
│   └── render_video.js# (opcional) graba la UI HTML a un .webm con Playwright
├── src/               # UI React + CSS cyberpunk (preview en navegador)
│   └── components/    # MatrixRain, Sparkline, GroupCard, LevelHUD, WeightPanel
└── dist/              # build estático
```

Variables de entorno de `webkit.py`:

| Var | Default | Descripción |
|---|---|---|
| `GYM_WALLPAPER_URL` | `http://localhost:8787` | página a cargar |
| `GYM_WALLPAPER_CLASS` | `org.gym.wallpaper` | class/app-id (hyprwinwrap lo busca exacto) |
| `GYM_WALLPAPER_DMABUF` | `0` | `1` = reactiva dmabuf (evita protocol error Gdk) |
| `GYM_WALLPAPER_COMPOSITING` | `0` | `1` = reactiva compositing (evita congelar animaciones) |

---

## 🔬 Investigación técnica (por qué está hecho así)

El reto real era **"wallpaper HTML animado detrás de todo en Hyprland"**. Se
probó a fondo y esto es lo que se descubrió:

1. **Layer-shell (`background`/`bottom`)** — se ve detrás de todo, pero
   **Hyprland no envía frame callbacks** a esas capas: cualquier animación se
   congela (verificado con GTK puro, WebKitGTK y canvas).
2. **Layer `top`/`overlay`** — animan, pero van **delante** de las ventanas.
3. **`hyprwinwrap`** ✅ envuelve una **ventana normal** como fondo. Las ventanas
   normales sí reciben repintados (aunque en ráfagas por el ahorro de energía de
   Hyprland). WebKitGTK renderiza la app HTML y, con `WEBKIT_DISABLE_DMABUF
   _RENDERER=1` + `WEBKIT_DISABLE_COMPOSITING_MODE=1`, las animaciones viven.
4. **El "fondo naranja" que tapaba el wallpaper** era el widget **EWW Counter**
   (`counter-overlay`): una capa `bottom` con una imagen a pantalla completa,
   por ENCIMA del nivel `background` de hyprwinwrap. Se desactivó (ver
   `~/Documents/obsidian/Proyects/Wallpaper-Counter.md`) y el wallpaper quedó
   visible.

Consecuencia: el fondo se repinta en ráfagas sincronizadas con la actividad de
la pantalla (más vivo mientras trabajas; estático pero con las stats al día
cuando estás inactivo). Es el límite real de la plataforma.

También se validó el servidor: cache por mtime y `GET /api/stats` con datos
reales (Push +2.2%, Pull +4.8%, PRs detectados, NIVEL 1).

---

## 📝 Registro de sesiones

- **Ejercicios**: abre el `.md` de la carpeta `Push/`, `Pull/` o `Leg/` en
  Obsidian y añade una fila al final de la tabla, p. ej.:
  `| 14 | 15 | 12 | 10 |`  → 14 kg, 15/12/10 reps.
- **Peso diario**: en `Peso.md`, añade `| 2026-08-04 | 75.3 |`.
- El wallpaper reflejará el cambio en segundos.

## 🛠️ Scripts

```bash
npm run dev          # server + vite (hot reload) para desarrollo
npm run build        # build de la UI
npm start            # producción: server + dist/ en :8787
npm run wallpaper    # lanza el wallpaper (orquestador: server + ventana WebKit)
npm run render:video # (opcional) graba la UI HTML a un .webm con Playwright
```
