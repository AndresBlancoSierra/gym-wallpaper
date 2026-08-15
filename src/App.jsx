import { useEffect, useState } from 'react'
import MatrixRain from './components/MatrixRain.jsx'
import GroupCard from './components/GroupCard.jsx'
import PesoCard from './components/PesoCard.jsx'
import VolleyCard from './components/VolleyCard.jsx'
import GymCounter from './components/GymCounter.jsx'

const POLL_MS = 2000

function useStats() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const r = await fetch('/api/stats')
        if (!r.ok) throw new Error(String(r.status))
        const data = await r.json()
        if (alive) {
          setStats(data)
          setError(false)
        }
      } catch {
        if (alive) setError(true)
      }
    }
    load()
    const t = setInterval(load, POLL_MS)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  return { stats, error }
}

export default function App() {
  const { stats, error } = useStats()

  return (
    <div className="app">
      <div className="app__matrix">
        <MatrixRain />
      </div>
      <div className="app__content">
        <div className="side-group">
          {(['push', 'pull', 'leg']).map((k) => (
            <GroupCard key={k} group={stats ? stats.groups[k] : null} error={error} tone={k} />
          ))}
          <PesoCard weight={stats ? stats.weight : null} error={error} />
          <VolleyCard volley={stats ? stats.volley : null} error={error} />
        </div>

        <GymCounter counter={stats ? stats.counter : null} error={error} />
      </div>

      <div className="fx-scanlines" aria-hidden="true" />
      <div className="fx-vignette" aria-hidden="true" />
      <div className="fx-edge-glow" aria-hidden="true" />
    </div>
  )
}
