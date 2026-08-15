export default function VolleyCard({ volley, error }) {
  const count = volley ? volley.count : null

  return (
    <div className="g-box g-box--red">
      <div className="g-box__head">
        <span className="g-box__title neon-text--red">VOLLEY</span>
        {error ? (
          <span className="delta-na blink">OFFLINE</span>
        ) : !volley ? (
          <span className="delta-na blink">…</span>
        ) : (
          <span className="g-box__delta">{count}</span>
        )}
      </div>
    </div>
  )
}
