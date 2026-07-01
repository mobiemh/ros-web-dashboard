import { useCallback, useEffect, useRef, useState } from 'react';
import ROSLIB from 'roslib';

/**
 * 로봇 데이터 소스 훅. 세 가지 모드를 같은 인터페이스로 노출한다.
 *   - 'demo'      : ROS 없이 /odom 가짜 데이터 (초기 개발/스크린샷용)
 *   - 'rosbridge' : 브라우저 ↔ rosbridge 직결 (roslib)
 *   - 'backend'   : 브라우저 ↔ FastAPI 백엔드(:8000/ws) ↔ ROS  ← 풀스택 운영 구조
 *
 * 컴포넌트는 subscribe('/odom', type, cb) / advertise('/cmd_vel', type) 만 쓰므로
 * 모드가 바뀌어도 컴포넌트 코드는 그대로다 (데이터 소스만 교체).
 *
 * 반환: { status, subscribe, advertise }
 */
export function useRos({ mode, rosbridgeUrl, backendUrl }) {
  const [status, setStatus] = useState('connecting');
  const rosRef = useRef(null); // rosbridge (ROSLIB.Ros)
  const wsRef = useRef(null); // backend WebSocket
  const subsRef = useRef({}); // demo/backend 구독 레지스트리 { name: cb[] }

  // rosbridge 인스턴스는 렌더 중 1회 생성 (advertise 가 렌더 중 호출되므로 미리 있어야 함)
  if (mode === 'rosbridge' && !rosRef.current) {
    rosRef.current = new ROSLIB.Ros({});
  }

  useEffect(() => {
    if (mode === 'demo') {
      setStatus('demo');
      // fake_robot 과 동일하게 위치·방향을 적분 → 데모도 실제 heading 을 가짐
      let x = 0;
      let y = 0;
      let th = 0;
      const lin = 0.2;
      const ang = 0.5;
      const dt = 0.1;
      const id = setInterval(() => {
        th += ang * dt;
        x += lin * Math.cos(th) * dt;
        y += lin * Math.sin(th) * dt;
        dispatch(subsRef.current, '/odom', odomShape(x, y, lin, ang, th));
      }, 100);
      return () => clearInterval(id);
    }

    if (mode === 'backend') {
      setStatus('connecting');
      let ws;
      let timer;
      let closed = false;
      const connect = () => {
        ws = new WebSocket(backendUrl);
        wsRef.current = ws;
        ws.onopen = () => setStatus('connected');
        ws.onerror = () => setStatus('error');
        ws.onclose = () => {
          setStatus('disconnected');
          if (!closed) timer = setTimeout(connect, 2000);
        };
        ws.onmessage = (ev) => {
          const m = JSON.parse(ev.data);
          if (m.type === 'robots') {
            const r = (m.data || []).find((x) => x.id === 'robot1') || (m.data || [])[0];
            if (r) dispatch(subsRef.current, '/odom', odomShape(r.x, r.y, r.vx, r.wz, r.yaw ?? 0));
          }
        };
      };
      connect();
      return () => {
        closed = true;
        clearTimeout(timer);
        if (ws) ws.close();
        wsRef.current = null;
      };
    }

    // rosbridge
    const ros = rosRef.current;
    let timer;
    const connect = () => {
      setStatus('connecting');
      ros.connect(rosbridgeUrl);
    };
    const onConn = () => setStatus('connected');
    const onErr = () => setStatus('error');
    const onClose = () => {
      setStatus('disconnected');
      timer = setTimeout(connect, 2000);
    };
    ros.on('connection', onConn);
    ros.on('error', onErr);
    ros.on('close', onClose);
    connect();
    return () => {
      clearTimeout(timer);
      ros.off?.('connection', onConn);
      ros.off?.('error', onErr);
      ros.off?.('close', onClose);
      ros.close();
    };
  }, [mode, rosbridgeUrl, backendUrl]);

  const subscribe = useCallback(
    (name, type, cb) => {
      if (mode === 'rosbridge') {
        const topic = new ROSLIB.Topic({ ros: rosRef.current, name, messageType: type });
        topic.subscribe(cb);
        return () => topic.unsubscribe();
      }
      // demo / backend: 레지스트리에 등록
      const arr = subsRef.current[name] || (subsRef.current[name] = []);
      arr.push(cb);
      return () => {
        subsRef.current[name] = arr.filter((f) => f !== cb);
      };
    },
    [mode]
  );

  const advertise = useCallback(
    (name, type) => {
      if (mode === 'rosbridge') {
        return new ROSLIB.Topic({ ros: rosRef.current, name, messageType: type });
      }
      if (mode === 'backend') {
        return {
          publish: (msg) => {
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'cmd_vel',
                  linear: msg.linear?.x ?? 0,
                  angular: msg.angular?.z ?? 0,
                })
              );
            }
          },
        };
      }
      // demo
      return { publish: (msg) => console.log('[demo publish]', name, msg) };
    },
    [mode]
  );

  return { status, subscribe, advertise };
}

// /odom 과 같은 형태의 메시지를 만들어 컴포넌트가 모드에 무관하게 쓰게 함.
// yaw(방향)는 ROS 관례대로 쿼터니언 z,w 로 담는다 (평면 로봇).
function odomShape(x, y, vx, wz, yaw = 0) {
  return {
    pose: {
      pose: {
        position: { x, y, z: 0 },
        orientation: { x: 0, y: 0, z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) },
      },
    },
    twist: { twist: { linear: { x: vx, y: 0, z: 0 }, angular: { x: 0, y: 0, z: wz } } },
  };
}

function dispatch(subs, name, msg) {
  (subs[name] || []).forEach((cb) => cb(msg));
}
