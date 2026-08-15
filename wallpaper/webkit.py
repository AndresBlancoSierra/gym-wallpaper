#!/usr/bin/env python3
"""
GYM.OS WALLPAPER (HTML) — ventana WebKitGTK con la app React de stats,
para que el plugin `hyprwinwrap` la use como fondo de pantalla.

Por qué WebKitGTK y no otra cosa (investigación previa):
- Hyprland congelaba las capas layer-shell `background`/`bottom` (sin frame
  callbacks) → el HTML nunca animaba ahí.
- `hyprwinwrap` envuelve una VENTANA NORMAL como fondo. Las ventanas normales
  sí reciben repintados (en ráfagas por el ahorro de energía de Hyprland), así
  que el HTML renderiza y anima en ráfagas, con las stats en vivo.

Fixes aplicados a WebKitGTK bajo Hyprland:
- `WEBKIT_DISABLE_DMABUF_RENDERER=1` → evita un "protocol error" de Gdk.
- `WEBKIT_DISABLE_COMPOSITING_MODE=1` → evita que las animaciones se congelen
  (el compositor de WebKit espera frame callbacks que Hyprland no envía a
  ventanas ocultas; forzamos el pintado síncrono).

Variables de entorno:
  GYM_WALLPAPER_URL         página a cargar (default http://localhost:8787)
  GYM_WALLPAPER_CLASS       class/app-id (default org.gym.wallpaper)
  GYM_WALLPAPER_DMABUF      =1 reactiva dmabuf
  GYM_WALLPAPER_COMPOSITING =1 reactiva compositing
"""

import os

import gi

gi.require_version('Gdk', '3.0')
gi.require_version('GLib', '2.0')
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')

from gi.repository import Gdk, GLib, Gtk, WebKit2  # noqa: E402

URL = os.environ.get('GYM_WALLPAPER_URL', 'http://localhost:8787')
CLASS = os.environ.get('GYM_WALLPAPER_CLASS', 'org.gym.wallpaper')
TITLE = os.environ.get('GYM_WALLPAPER_TITLE', 'GYM.OS WALLPAPER')

if os.environ.get('GYM_WALLPAPER_DMABUF') != '1':
    os.environ['WEBKIT_DISABLE_DMABUF_RENDERER'] = '1'
if os.environ.get('GYM_WALLPAPER_COMPOSITING') != '1':
    os.environ['WEBKIT_DISABLE_COMPOSITING_MODE'] = '1'

retry_timeout = None


def on_load_failed(webview, _event, _uri, error):
    global retry_timeout
    print(f'[wallpaper] load-failed: {_uri} ({error})', flush=True)
    if retry_timeout is None:
        retry_timeout = GLib.timeout_add_seconds(5, retry_load, webview)
    return True


def retry_load(webview):
    global retry_timeout
    retry_timeout = None
    webview.load_uri(URL)
    return GLib.SOURCE_REMOVE


def build_window(app):
    win = Gtk.Window(application=app)
    win.set_title(TITLE)

    webview = WebKit2.WebView()
    settings = webview.get_settings()
    settings.set_enable_back_forward_navigation_gestures(False)

    # Evita el destello blanco durante la carga
    try:
        webview.set_background_color(Gdk.RGBA(1, 2, 4, 1))
    except Exception:  # noqa: BLE001
        pass

    webview.connect('load-failed', on_load_failed)
    webview.load_uri(URL)

    win.add(webview)
    win.show_all()

    def report():
        print(f'[wallpaper] cargado {URL} mapped={win.get_mapped()}', flush=True)
        return False  # una sola vez

    GLib.timeout_add_seconds(3, report)

    # Sin reload periódico: la app React ya hace poll de las stats cada 2s.
    return win


def on_activate(app):
    build_window(app)


def main():
    # GTK3 en Wayland deriva la app_id (class de Hyprland) de g_prgname().
    try:
        GLib.set_prgname(CLASS)
        Gdk.set_program_class(CLASS)
    except Exception:  # noqa: BLE001
        pass

    app = Gtk.Application(application_id=CLASS)
    app.connect('activate', on_activate)
    app.run(None)


if __name__ == '__main__':
    main()
