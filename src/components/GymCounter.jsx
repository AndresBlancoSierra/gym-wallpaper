export default function GymCounter({ counter, error }) {
  const days = counter ? counter.days : null

  return (
    <div className="countdown">
      <div
        className="countdown__num glitch glitch--intense"
        data-text={days}
      >
        <span className="glitch__layer">{days}</span>
        {days}
      </div>
    </div>
  )
}
