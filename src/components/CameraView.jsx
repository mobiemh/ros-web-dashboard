import { useEffect, useRef, useState } from 'react';
import { TOPICS } from '../ros/topics';
import { connectWebrtcRos } from '../ros/webrtcRos';

// 로봇 카메라 실시간 영상 패널.
//  - demo 모드      : 노트북 웹캠(getUserMedia)을 로봇 카메라 대역으로 표시 (ROS 없이 UI 확인용)
//  - rosbridge/backend: webrtc_ros 서버에 붙어 ROS 이미지 토픽을 WebRTC 로 수신
//
// odom/scan 처럼 useRos 훅을 타지 않는 이유: 카메라는 rosbridge(JSON)가 아니라
// 별도 WebRTC 경로(webrtcRos.js)를 쓰기 때문. mode 만 보고 소스를 스스로 고른다.
export default function CameraView({ mode, cameraUrl }) {
  const videoRef = useRef(null);
  const [state, setState] = useState('connecting'); // connecting|connected|disconnected|error|denied
  const [detail, setDetail] = useState('');

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    const attach = (stream) => {
      if (cancelled) return;
      if (videoRef.current) videoRef.current.srcObject = stream;
    };

    if (mode === 'demo') {
      setState('connecting');
      setDetail('데모: 웹캠을 로봇 카메라 대역으로 표시');
      navigator.mediaDevices
        ?.getUserMedia({ video: true, audio: false })
        .then((stream) => {
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          attach(stream);
          setState('connected');
          cleanup = () => stream.getTracks().forEach((t) => t.stop());
        })
        .catch(() => setState('denied'));
      return () => {
        cancelled = true;
        cleanup();
      };
    }

    // rosbridge / backend → webrtc_ros
    setState('connecting');
    setDetail(`${cameraUrl}  ·  ${TOPICS.camera.name}`);
    const stop = connectWebrtcRos({
      url: cameraUrl,
      topic: TOPICS.camera.name,
      onStream: attach,
      onStatus: setState,
      onError: (e) => console.error('[webrtc_ros]', e),
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [mode, cameraUrl]);

  const overlay = {
    connecting: '영상 연결 중…',
    disconnected: '영상 끊김 — webrtc_ros 서버 확인',
    error: 'webrtc_ros 연결 오류',
    denied: '웹캠 접근이 거부되었습니다',
  }[state];

  return (
    <div className="card camera">
      <div className="card-title">Camera ({mode === 'demo' ? 'webcam' : TOPICS.camera.name})</div>
      <div className="camera-frame">
        <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
        {state !== 'connected' && <div className="camera-overlay">{overlay}</div>}
      </div>
      <div className="camera-detail">{detail}</div>
    </div>
  );
}
