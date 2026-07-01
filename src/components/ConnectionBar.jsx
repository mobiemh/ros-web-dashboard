const COLORS = {
  connected: '#22c55e',
  connecting: '#eab308',
  disconnected: '#ef4444',
  error: '#ef4444',
  demo: '#8b5cf6',
};

export default function ConnectionBar({ status, mode, onModeChange }) {
  const color = COLORS[status] || '#888';

  return (
    <header className="topbar">
      <div className="brand">🤖 ROS Web Dashboard</div>
      <div className="conn">
        <label className="demo-toggle">
          모드
          <select value={mode} onChange={(e) => onModeChange(e.target.value)}>
            <option value="demo">Demo (ROS 없이)</option>
            <option value="rosbridge">rosbridge 직결 (:9090)</option>
            <option value="backend">백엔드 브릿지 (:8000)</option>
          </select>
        </label>
        <span className="dot" style={{ background: color }} />
        <span className="status">{status}</span>
      </div>
    </header>
  );
}
