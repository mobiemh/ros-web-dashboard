// 격리 검증: 대시보드와 동일 경로(브라우저→rosbridge:9090→/odom)가 되는지
// 프론트 없이 확인. Gazebo/rosbridge 가 떠 있을 때 실행.
//   node scripts/dev-tests/test-rosbridge-odom.mjs
const ws = new WebSocket('ws://localhost:9090');
let got = false;
ws.onopen = () => {
  ws.send(JSON.stringify({ op: 'subscribe', topic: '/odom', type: 'nav_msgs/msg/Odometry' }));
  console.log('subscribed /odom via rosbridge');
};
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.op === 'publish' && m.topic === '/odom') {
    const p = m.msg.pose.pose.position;
    console.log(`ROSBRIDGE /odom OK: x=${p.x.toFixed(3)} y=${p.y.toFixed(3)}`);
    got = true;
    ws.close();
    process.exit(0);
  }
};
ws.onerror = (e) => { console.log('ws error', e.message); process.exit(1); };
setTimeout(() => { if (!got) { console.log('6초 내 /odom 안 옴'); process.exit(1); } }, 6000);
