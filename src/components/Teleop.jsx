import { useMemo } from 'react';
import ROSLIB from 'roslib';
import { TOPICS } from '../ros/topics';

// /cmd_vel 로 Twist 를 발행하는 원격 조작 패드.
// advertise 가 바뀌면(모드 전환) publisher 를 다시 만든다.
export default function Teleop({ advertise }) {
  const pub = useMemo(
    () => advertise(TOPICS.cmdVel.name, TOPICS.cmdVel.type),
    [advertise]
  );

  const send = (lx, az) => {
    pub.publish(
      new ROSLIB.Message({
        linear: { x: lx, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: az },
      })
    );
  };

  return (
    <div className="card teleop">
      <div className="card-title">Teleop (/cmd_vel)</div>
      <div className="pad">
        <button onClick={() => send(0.2, 0)}>▲</button>
        <div className="pad-row">
          <button onClick={() => send(0, 0.5)}>◀</button>
          <button className="stop" onClick={() => send(0, 0)}>
            ■
          </button>
          <button onClick={() => send(0, -0.5)}>▶</button>
        </div>
        <button onClick={() => send(-0.2, 0)}>▼</button>
      </div>
    </div>
  );
}
