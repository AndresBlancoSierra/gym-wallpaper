import { useEffect, useState } from 'react'

const TARGET = new Date(2027, 6, 31, 23, 59, 59)
const DAY_MS = 24 * 60 * 60 * 1000

function daysLeft() {
  return Math.max(0, Math.ceil((TARGET - Date.now()) / DAY_MS))
}

export default function Countdown() {
  const [days, setDays] = useState(daysLeft)

  useEffect(() => {
    const t = setInterval(() => setDays(daysLeft()), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="countdown">
      <div className="countdown__num glitch glitch--intense" data-text={days}>
        <span className="glitch__layer">{days}</span>
        {days}
      </div>
    </div>
  )
}
