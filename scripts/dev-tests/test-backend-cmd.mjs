// 격리 검증: 프론트 없이 백엔드(:8000/ws) 명령 경로가 되는지 확인.
// 백엔드→ROS /cmd_vel 발행이 로봇에 반영되는지 (GET /api/robots 로 vx/wz 확인).
//   node scripts/dev-tests/test-backend-cmd.mjs [linear] [angular]
//   예) 정지: node ... 0 0   /  원운동: node ... 0.2 0.5
const linear = Number(process.argv[2] ?? 0);
const angular = Number(process.argv[3] ?? 0);
const ws = new WebSocket('ws://localhost:8000/ws');
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'cmd_vel', linear, angular }));
  console.log(`sent cmd_vel linear=${linear} angular=${angular}`);
  setTimeout(() => { ws.close(); process.exit(0); }, 600);
};
ws.onerror = (e) => { console.log('ws error', e.message); process.exit(1); };
