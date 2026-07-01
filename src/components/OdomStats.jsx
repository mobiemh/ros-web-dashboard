import { useEffect, useState } from 'react';
import { TOPICS } from '../ros/topics';
import StatCard from './StatCard';

// /odom 을 구독해 위치·속도를 카드로 표시.
export default function OdomStats({ subscribe }) {
  const [odom, setOdom] = useState(null);

  useEffect(() => subscribe(TOPICS.odom.name, TOPICS.odom.type, setOdom), [subscribe]);

  const pos = odom?.pose?.pose?.position;
  const tw = odom?.twist?.twist;
  const f = (n) => (n ?? 0).toFixed(2);

  return (
    <div className="stats-grid">
      <StatCard label="Position X" value={f(pos?.x)} unit="m" />
      <StatCard label="Position Y" value={f(pos?.y)} unit="m" />
      <StatCard label="Linear vel" value={f(tw?.linear?.x)} unit="m/s" />
      <StatCard label="Angular vel" value={f(tw?.angular?.z)} unit="rad/s" />
    </div>
  );
}
