import { useEffect, useRef } from 'react';
import { TOPICS } from '../ros/topics';

// /odom 위치를 캔버스에 실시간 궤적으로 그리고, 로봇의 방향(heading)을 화살표로 표시.
export default function PoseCanvas({ subscribe }) {
  const canvasRef = useRef(null);
  const trailRef = useRef([]);
  const yawRef = useRef(0);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // grid
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1;
      for (let i = 0; i <= width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let j = 0; j <= height; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(width, j);
        ctx.stroke();
      }

      const scale = 40; // px / meter
      const cx = width / 2;
      const cy = height / 2;
      const toPx = (x, y) => [cx + x * scale, cy - y * scale];

      // trail
      const trail = trailRef.current;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      trail.forEach((pt, i) => {
        const [px, py] = toPx(pt.x, pt.y);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      const last = trail[trail.length - 1];
      if (last) {
        const [px, py] = toPx(last.x, last.y);
        const yaw = yawRef.current;

        // heading 화살표 (제자리 회전도 이걸로 보임)
        const len = 22;
        // 캔버스는 y축이 아래로 향하므로 sin 부호를 뒤집음
        const hx = px + Math.cos(yaw) * len;
        const hy = py - Math.sin(yaw) * len;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        // 화살촉
        const a = yaw;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - Math.cos(a - 0.4) * 7, hy + Math.sin(a - 0.4) * 7);
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - Math.cos(a + 0.4) * 7, hy + Math.sin(a + 0.4) * 7);
        ctx.stroke();

        // 로봇 점
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const unsub = subscribe(TOPICS.odom.name, TOPICS.odom.type, (msg) => {
      const p = msg.pose.pose.position;
      const o = msg.pose.pose.orientation;
      if (o) yawRef.current = 2 * Math.atan2(o.z, o.w); // 쿼터니언 → yaw
      const trail = trailRef.current;
      trail.push({ x: p.x, y: p.y });
      if (trail.length > 500) trail.shift();
      draw();
    });

    draw();
    return unsub;
  }, [subscribe]);

  return (
    <div className="card">
      <div className="card-title">Position + Heading (/odom)</div>
      <canvas ref={canvasRef} width={420} height={320} className="canvas" />
    </div>
  );
}
