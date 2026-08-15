import { useEffect, useRef } from 'react'

const CHARS = 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF<>/{}[]=+*#$%&@'
const COLORS = ['#00ff41', '#00cc2c', '#008f11']

export default function MatrixRain({ fontSize = 16, speed = 120, className = '', ...props }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let width = 0
    let height = 0
    let drops = []
    let dropColors = []
    let timer = null

    // Resolución 1:1 para que la lluvia se vea nítida (sin desenfoque).
    const scale = 1

    const resize = () => {
      width = Math.floor(canvas.offsetWidth * scale)
      height = Math.floor(canvas.offsetHeight * scale)
      canvas.width = width
      canvas.height = height
      // gotas distribuidas en TODA la altura (no solo arriba)
      drops = Array.from({ length: Math.ceil(width / (fontSize * scale)) }, () =>
        Math.floor(Math.random() * height),
      )
      dropColors = Array.from({ length: drops.length }, () =>
        COLORS[Math.floor(Math.random() * COLORS.length)],
      )
    }

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 2, 1, 0.05)'
      ctx.fillRect(0, 0, width, height)
      ctx.font = `${fontSize * scale}px monospace`
      for (let i = 0; i < drops.length; i++) {
        const y = drops[i]
        if (y > -fontSize && y < height + fontSize) {
          ctx.fillStyle = dropColors[i]
          ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * fontSize * scale, y)
        }
        if (y > height && Math.random() > 0.975) {
          drops[i] = 0
          dropColors[i] = COLORS[Math.floor(Math.random() * COLORS.length)]
        } else drops[i] = y + (fontSize * scale * 0.9)
      }
    }

    // WebKit/layer-shell: la surface puede cambiar de tamaño tras montar,
    // así que observamos el contenedor (no solo el resize de la ventana).
    resize()
    window.addEventListener('resize', resize)
    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(resize)
      if (canvas.parentElement) ro.observe(canvas.parentElement)
    }
    timer = setInterval(draw, speed)
    return () => {
      window.removeEventListener('resize', resize)
      if (ro) ro.disconnect()
      clearInterval(timer)
    }
  }, [fontSize, speed])

  return <canvas ref={ref} className={className} {...props} />
}
