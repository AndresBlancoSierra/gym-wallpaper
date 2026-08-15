export const fmtPct = (v) =>
  v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(v > 9.95 || v < -9.95 ? 0 : 1)}%`

const TONES = { push: 'yellow', pull: 'yellow', leg: 'yellow' }

export default function GroupCard({ group, error, tone = 'red' }) {
  const color = TONES[tone] || 'red'
  const name = group ? group.name.toUpperCase() : '···'
  const hasData = group ? group.hasData : false
  const pct = group ? group.deltaPctAvg : null

  return (
    <div className={`g-box g-box--${color}`}>
      <div className="g-box__head">
        <span className={`g-box__title neon-text--${color}`}>{name}</span>
        {error ? (
          <span className="delta-na blink">OFFLINE</span>
        ) : !group ? (
          <span className="delta-na blink">…</span>
        ) : hasData ? (
          <span className="g-box__delta">{fmtPct(pct)}</span>
        ) : (
          <span className="delta-na">SIN DATOS</span>
        )}
      </div>
    </div>
  )
}
