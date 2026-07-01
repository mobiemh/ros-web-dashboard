export default function StatCard({ label, value, unit }) {
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {unit && <span className="unit"> {unit}</span>}
      </div>
    </div>
  );
}
