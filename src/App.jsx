import { useState } from 'react';
import { useRos } from './ros/useRos';
import ConnectionBar from './components/ConnectionBar';
import OdomStats from './components/OdomStats';
import PoseCanvas from './components/PoseCanvas';
import Teleop from './components/Teleop';
import CameraView from './components/CameraView';

export default function App() {
  const [mode, setMode] = useState('demo'); // demo | rosbridge | backend
  const { status, subscribe, advertise } = useRos({
    mode,
    rosbridgeUrl: 'ws://localhost:9090',
    backendUrl: 'ws://localhost:8000/ws',
  });
  // 카메라는 rosbridge(:9090)가 아니라 webrtc_ros 서버(기본 :8080/webrtc)로 붙는다.
  const cameraUrl = 'ws://localhost:8080/webrtc';

  return (
    <div className="app">
      <ConnectionBar status={status} mode={mode} onModeChange={setMode} />

      <main className="grid">
        <section className="col">
          <OdomStats subscribe={subscribe} />
          <CameraView mode={mode} cameraUrl={cameraUrl} />
          <PoseCanvas subscribe={subscribe} />
        </section>

        <section className="col">
          <Teleop advertise={advertise} />

          {mode !== 'demo' && status !== 'connected' && (
            <div className="card hint">
              <div className="card-title">연결 대기 중</div>
              <ol>
                <li>
                  백엔드 모드: <code>docker compose --profile platform up --build</code> (:8000)
                </li>
                <li>
                  rosbridge 모드: <code>docker compose --profile direct up --build</code> (:9090)
                </li>
                <li>
                  카메라 영상: <code>ros2 run webrtc_ros webrtc_ros_server_node</code> (:8080)
                </li>
              </ol>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
