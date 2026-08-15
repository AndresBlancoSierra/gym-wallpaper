#!/usr/bin/env python3
"""
GYM.OS WALLPAPER (TUI) — dashboard cyberpunk animado para correr dentro de una
terminal (foot o Alacritty) que hyprwinwrap usa como fondo de pantalla.

Por qué una TUI: en Hyprland, las ventanas ocultas (fondo) no reciben frame
callbacks; WebKit/GTK/mpv dejan de pintar, pero las terminales (foot,
Alacritty) redibujan en bucle propio y SÍ se ven como fondo animado.

Usa solo ANSI (sin dependencias). Repinta cada ~90ms: lluvia Matrix,
neón, glitch del título, barras de progreso, reloj y stats en vivo (poll 2s).

Uso (dentro de foot/alacritty con class org.gym.wallpaper):
    python3 wallpaper/tui.py
"""

import json
import os
import random
import shutil
import sys
import time
import urllib.request

API = os.environ.get('GYM_WALLPAPER_API', 'http://localhost:8787/api/stats')
POLL = 2.0        # segundos entre recargas de stats
TICK = 0.09       # segundos por frame de animación

# ---- paleta ANSI 256 (ciberpunk) ----
CYAN = '\x1b[38;5;45m'
CYAN_B = '\x1b[1;38;5;51m'
MAGENTA = '\x1b[38;5;199m'
MAGENTA_B = '\x1b[1;38;5;201m'
YELLOW = '\x1b[38;5;226m'
YELLOW_B = '\x1b[1;38;5;228m'
GREEN = '\x1b[38;5;47m'
GREEN_B = '\x1b[1;38;5;46m'
RED = '\x1b[38;5;196m'
DIM = '\x1b[2m'
RESET = '\x1b[0m'
BOLD = '\x1b[1m'
BG_DARK = '\x1b[48;5;232m'
BG_BLACK = '\x1b[48;5;0m'

# ---- lluvia Matrix ----
MATRIX_CHARS = 'アイウエオカキクケコサシスセソ0123456789<>/{}[]=+*#$%@'

# ---- estado global ----
stats = None
clock = 0.0
matrix = []  # por columna: [y, speed, bright]


def init_matrix(cols, rows):
    global matrix
    matrix = [
        [random.randint(-rows, rows), random.random() * 0.4 + 0.2, random.random() < 0.2]
        for _ in range(cols)
    ]


def fetch_stats():
    global stats
    try:
        with urllib.request.urlopen(API, timeout=3) as r:
            stats = json.load(r)
    except Exception:
        pass


def fmt_pct(v):
    if v is None:
        return '--'
    sign = '+' if v > 0 else ''
    return f'{sign}{v:.1f}%'


def fmt_kg(v):
    return '--' if v is None else f'{v:g}kg'


def fmt_time(ts):
    return time.strftime('%H:%M:%S', time.localtime(ts))


# ---------- helpers de layout ----------
def clip(s, w):
    s = str(s)
    return s[:w].ljust(w)


def bar(pct, w):
    pct = max(0.0, min(1.0, pct))
    filled = int(pct * w)
    return (GREEN_B + '█' * filled + DIM + '░' * (w - filled) + RESET)


def arrow(v):
    if v is None:
        return '·'
    if v > 0.5:
        return '▲'
    if v < -0.5:
        return '▼'
    return '='


def delta_color(v):
    if v is None:
        return DIM
    if v > 0.5:
        return GREEN
    if v < -0.5:
        return RED
    return DIM


# ---------- render de paneles ----------
def render_panel(group, x, w, h, chars):
    g = stats['groups'][group]
    # borde superior
    chars[0] = chars[0][:x] + CYAN + '┌─ ' + RESET
    name = group.upper()
    if group == 'pull':
        name = MAGENTA + name + RESET
    elif group == 'leg':
        name = YELLOW + name + RESET
    else:
        name = CYAN_B + name + RESET
    delta = g['deltaPct'] if g['hasData'] else None
    dcol = delta_color(delta)
    head = f"{name}  {dcol}{fmt_pct(delta)} {arrow(delta)}{RESET}"
    mid = (w - 2 - 4)
    chars[0] = chars[0][:x] + '┌─ ' + head[:w - 6].ljust(w - 5) + '┐' + chars[0][x + w:]
    row = 1
    # barra de volumen
    if g['hasData'] and g['firstVolume'] > 0:
        pct = g['lastVolume'] / g['firstVolume']
        chars[row] = chars[row][:x] + '│ ' + bar(pct, w - 5) + ' ' + chars[row][x + w:]
    else:
        chars[row] = chars[row][:x] + '│ ' + DIM + 'sin datos' + RESET + ' ' * (w - 10) + chars[row][x + w:]
    row += 1
    # ejercicios
    for ex in g['exercises'][:h - 4]:
        line = '│ '
        if not ex['hasData']:
            line += DIM + ex['name'][:w - 12].ljust(w - 10) + RESET
        else:
            nm = ex['name'][:20].ljust(20)
            load = (f"{ex['lastKg']:g}kg ×{ex['lastMaxSet']}" if not ex['band']
                    else f"{ex['lastReps']}reps")
            dcol = delta_color(ex['deltaPct'])
            d = 'BASE' if ex.get('singleSession') else f"{fmt_pct(ex['deltaPct'])} {arrow(ex['deltaPct'])}"
            pr = ' ' + YELLOW_B + '◆' + RESET if ex.get('pr') else ''
            line += nm + DIM + load.ljust(11) + RESET + dcol + d.ljust(10) + RESET + pr
        chars[row] = chars[row][:x] + clip(line, w) + chars[row][x + w:]
        row += 1
    # borde inferior
    while row < h - 1:
        chars[row] = chars[row][:x] + '│' + ' ' * (w - 2) + '│' + chars[row][x + w:]
        row += 1
    chars[row] = chars[row][:x] + '└' + '─' * (w - 2) + '┘' + chars[row][x + w:]


def render_hud(chars, w, h):
    g = stats['gamification']
    wp = stats['weight']
    # fila de nivel
    y = h - 3
    lv = f"{CYAN_B}NIVEL {g['level']}{RESET}  {MAGENTA_B}{g['rank'].upper()}{RESET}"
    xp = f"{g['xp']} XP  → {max(0, round(g['toNext'] - g['intoLevel']))} XP al siguiente"
    chars[y] = ' ' + lv + ' ' * (w - len(lv) - len(xp) - 4) + xp + ' '
    y += 1
    chars[y] = ' ' + bar(g['progress'], w - 2) + ' '
    # fila de peso
    y += 1
    if wp['hasData']:
        wt = f"{CYAN_B}{wp['current']:g}{RESET} kg"
        dcol = delta_color(wp['delta'])
        dt = f"{dcol}{fmt_kg(wp['delta'])} ({fmt_pct(wp['deltaPct'])}{RESET})"
        streak = f"racha {GREEN}{wp['streak']}{RESET} días" if wp['streak'] else (YELLOW + '¡pésate hoy!' + RESET)
        sessions = f"{g['sessions']} sesiones"
        chars[y] = ' ' + wt + '  ' + dt + ' ' * max(1, w - 4 - len(wt) - len(dt) - len(streak) - len(sessions)) + streak + '  ' + sessions + ' '


def render_matrix(chars, w, h):
    """Pinta la lluvia Matrix como fondo (verde tenue)."""
    global clock
    # barrido de una fila 'scanline' de luz
    for col in range(len(matrix)):
        my, speed, bright = matrix[col]
        y = int(my)
        if 0 <= y < h - 5:
            ch = MATRIX_CHARS[random.randint(0, len(MATRIX_CHARS) - 1)]
            # cabeza brillante + estela de 4 caracteres verdes
            for t in range(5):
                ty = y - t
                if 0 <= ty < h - 2 and col < w:
                    r = chars[ty]
                    if t == 0:
                        r = r[:col] + GREEN_B + ch + RESET + r[col + 1:]
                    else:
                        r = r[:col] + GREEN + MATRIX_CHARS[random.randint(0, len(MATRIX_CHARS) - 1)] + RESET + r[col + 1:]
                    chars[ty] = r
        matrix[col][0] = my + speed
        if my > h:
            matrix[col][0] = -random.randint(1, 10)


def draw_matrix_field(chars, w, h):
    # fondo verde apagado tenue (ráfagas)
    for _ in range(int(w * h / 30)):
        x = random.randint(0, w - 1)
        y = random.randint(0, h - 1)
        ch = MATRIX_CHARS[random.randint(0, len(MATRIX_CHARS) - 1)]
        row = chars[y]
        row = row[:x] + DIM + GREEN + ch + RESET + row[x + 1:]
        chars[y] = row


def render():
    global clock
    try:
        w, h = shutil.get_terminal_size()
    except Exception:
        w, h = 160, 45
    w = max(w, 40)
    h = max(h, 20)
    rows = [' ' * w for _ in range(h)]

    # fondo: matiz oscuro
    for i in range(h):
        rows[i] = BG_DARK + rows[i] + RESET

    # header
    title = CYAN_B + 'GYM.OS' + RESET
    sub = DIM + '// gamificación corporal' + RESET
    t = time.time()
    if int(t) % 6 < 0.35:
        # glitch del título
        title = MAGENTA + 'GYM.OS' + RESET
    status = (GREEN_B + '●' + RESET if stats else RED + '●' + RESET) + ' ' + \
             ('EN LÍNEA' if stats else 'OFFLINE') + '  ' + CYAN + fmt_time(t) + RESET
    rows[0] = BG_BLACK + ' ' + title + ' ' + sub + ' ' * max(1, w - len(title) - len(sub) - len(status) - 4) + status + ' ' + RESET

    # lluvia matrix
    if len(matrix) != w:
        init_matrix(w, h)
    render_matrix(rows, w, h)
    draw_matrix_field(rows, w, h)

    # paneles
    if stats:
        pw = max(20, (w - 4) // 3)
        render_panel('push', 1, pw, 12, rows)
        render_panel('pull', 2 + pw, pw, 12, rows)
        render_panel('leg', 3 + 2 * pw, pw, 12, rows)
        # panel de peso y nivel
        render_hud(rows, w, h)

    # marquee de logros (última fila)
    if stats:
        ach = stats['gamification']['achievements']
        text = '  ★  '.join(ach) if ach else 'REGISTRA TU PRIMERA SESIÓN'
        off = int((t * 8) % (len(text) + w))
        shown = (text + text)[off:off + w]
        rows[h - 1] = BG_BLACK + YELLOW + shown.ljust(w) + RESET

    # reloj parpadeante
    out = '\x1b[H\x1b[?25l'
    out += '\n'.join(rows)
    out += RESET
    sys.stdout.write(out)
    sys.stdout.flush()


def main():
    fetch_stats()
    init_matrix(shutil.get_terminal_size().columns or 160, 45)
    last_poll = 0.0
    try:
        while True:
            t = time.time()
            if t - last_poll >= POLL:
                fetch_stats()
                last_poll = t
            render()
            time.sleep(TICK)
    except KeyboardInterrupt:
        sys.stdout.write('\x1b[?25h\x1b[0m\n')
    finally:
        sys.stdout.write('\x1b[?25h\x1b[0m\n')


if __name__ == '__main__':
    main()
