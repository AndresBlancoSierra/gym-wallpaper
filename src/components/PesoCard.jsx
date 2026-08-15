const fmtKg = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(Math.abs(v) >= 9.95 ? 0 : 1)}`)

export default function PesoCard({ weight, error }) {
  const hasData = weight ? weight.hasData : false

  return (
    <div className="g-box g-box--orange">
      <div className="g-box__head">
        <span className="g-box__title neon-text--orange">PESO</span>
        {error ? (
          <span className="delta-na blink">OFFLINE</span>
        ) : !hasData ? (
          <span className="delta-na blink">SIN DATOS</span>
        ) : (
          <span className="g-box__delta">{fmtKg(weight.delta)}</span>
        )}
      </div>
    </div>
  )
}
