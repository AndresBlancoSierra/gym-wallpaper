#!/usr/bin/env python3
"""
WALLPAPER — orquestador del fondo de pantalla HTML.

El fondo es una página HTML mostrada en una ventana WebKitGTK (`webkit.py`)
que el plugin `hyprwinwrap` coloca como capa de fondo.

Dos modos:
  - HTML directo: si la variable WALLPAPER_URL está definida, no arranca ningún
    servidor propio y carga esa URL (p. ej. la página de stats de Fallout
    servida por http.server en :8123).
  - GYM.OS (legacy): sin WALLPAPER_URL, arranca el servidor de stats de gym
    (node server/index.js, puerto :8787) y carga su app React.

Variables:
  WALLPAPER_URL    URL de la página a mostrar (activa modo directo)
  WALLPAPER_CLASS  class/app-id de la ventana (default org.gym.wallpaper)
  WALLPAPER_TITLE  título de la ventana (default GYM.OS WALLPAPER)

Este script:
  1) En modo directo salta el paso del servidor.
  2) Lanza la ventana WebKit (`webkit.py`).
  3) Relanza la ventana si muere.
"""

import os
import subprocess
import sys
import time
import urllib.request

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = 'http://localhost:8787/api/stats'
WEBKIT = os.path.join(PROJECT, 'wallpaper', 'webkit.py')
SERVER = os.path.join(PROJECT, 'server', 'index.js')

URL = os.environ.get('WALLPAPER_URL', '').strip()
CLASS = os.environ.get('WALLPAPER_CLASS', '').strip()
TITLE = os.environ.get('WALLPAPER_TITLE', '').strip()


def server_up():
    try:
        with urllib.request.urlopen(API, timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def start_server():
    log = open(os.path.join(PROJECT, 'wallpaper', 'server.log'), 'a')
    return subprocess.Popen(['node', SERVER], stdout=log, stderr=log,
                            start_new_session=True)


def run_webkit():
    env = dict(os.environ)
    if URL:
        env['GYM_WALLPAPER_URL'] = URL
    if CLASS:
        env['GYM_WALLPAPER_CLASS'] = CLASS
    if TITLE:
        env['GYM_WALLPAPER_TITLE'] = TITLE
    return subprocess.Popen([sys.executable, WEBKIT], env=env,
                            start_new_session=True)


def main():
    if URL:
        print(f'[wallpaper] HTML directo: {URL} (sin servidor)')
    else:
        print('[wallpaper] GYM.OS wallpaper (HTML WebKit via hyprwinwrap)')
        if not server_up():
            print('[wallpaper] servidor no activo, arrancándolo...')
            start_server()
            for _ in range(20):
                time.sleep(1)
                if server_up():
                    break
        print('[wallpaper] servidor:', 'OK' if server_up() else 'OFFLINE')

    win = run_webkit()
    print(f'[wallpaper] ventana WebKit lanzada (pid {win.pid})')
    try:
        while True:
            time.sleep(5)
            if win.poll() is not None:
                print('[wallpaper] ventana terminó, relanzando...')
                win = run_webkit()
    except KeyboardInterrupt:
        win.terminate()
        print('\n[wallpaper] apagado')


if __name__ == '__main__':
    main()
