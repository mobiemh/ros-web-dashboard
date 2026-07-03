// ROS 카메라 → WebRTC 브리지 클라이언트 (aiortc 브리지용)
//
// camera-bridge/bridge.py (aiortc) 가 여는 WebSocket(/webrtc)에 붙어,
// ROS /camera/image_raw 를 WebRTC 로 브라우저에 받아온다.
//
// 왜 webrtc_ros(RobotWebTools)가 아니라 자체 aiortc 브리지인가:
//   webrtc_ros 는 크로미움 libwebrtc 소스 빌드가 필요하고 ROS2 지원이 3년 넘게 방치돼
//   빌드가 사실상 포팅 작업이 된다(DEVLOG D-010 참고). aiortc 는 pip 설치로 끝나고
//   ROS 카메라→aiortc 브리지는 로보틱스 실무에서 흔한 패턴이라 이쪽으로 전환.
//
// 시그널링 (non-trickle, 구현 단순):
//   1) 브라우저가 recvonly video 트랜시버로 offer 생성
//   2) ICE gathering 완료까지 대기 (host 후보를 SDP 에 다 담음)
//   3) { type:'offer', sdp } 전송 → 브리지가 { type:'answer', sdp } 응답
//   4) pc.ontrack 으로 원격 비디오 트랙 도착
//   (localhost/동일 호스트에선 host 후보만으로 충분 → 별도 ICE 메시지 불필요)

/**
 * @param {object} opts
 * @param {string} opts.url        브리지 WS URL (예: ws://localhost:8080/webrtc)
 * @param {string} [opts.topic]    참고용(브리지가 CAMERA_TOPIC 으로 결정). 미사용.
 * @param {RTCIceServer[]} [opts.iceServers]  외부망일 때만 STUN/TURN. 로컬은 불필요.
 * @param {(stream: MediaStream) => void} opts.onStream
 * @param {(status: string) => void} [opts.onStatus]  connecting|connected|disconnected|error
 * @param {(err: any) => void} [opts.onError]
 * @returns {() => void} 정리 함수
 */
export function connectWebrtcRos({ url, iceServers, onStream, onStatus, onError }) {
  const status = (s) => onStatus?.(s);
  status('connecting');

  const pc = new RTCPeerConnection(iceServers ? { iceServers } : {});
  const ws = new WebSocket(url);
  let closed = false;

  // 받기 전용 비디오 트랜시버
  try {
    pc.addTransceiver('video', { direction: 'recvonly' });
  } catch (_) {
    /* 구형 브라우저는 offerToReceiveVideo 로 폴백 */
  }

  pc.ontrack = (ev) => {
    if (closed) return;
    const stream = ev.streams?.[0] || new MediaStream([ev.track]);
    onStream?.(stream);
  };

  pc.oniceconnectionstatechange = () => {
    const s = pc.iceConnectionState;
    if (s === 'connected' || s === 'completed') status('connected');
    else if (s === 'failed' || s === 'disconnected' || s === 'closed') status('disconnected');
  };

  ws.onopen = async () => {
    try {
      const offer = await pc.createOffer({ offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      await waitIceComplete(pc); // non-trickle: 후보를 SDP 에 다 담아 보냄
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription.sdp }));
      }
    } catch (e) {
      onError?.(e);
      status('error');
    }
  };

  ws.onmessage = async (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));
      }
    } catch (e) {
      onError?.(e);
    }
  };

  // 시그널링 WS 는 협상용일 뿐 — 미디어는 PeerConnection 으로 흐른다.
  // 이미 ICE 가 연결됐으면 WS 가 닫혀도 영상은 계속 나오므로 disconnected 로 보지 않는다.
  const pcLive = () =>
    pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed';
  ws.onerror = () => {
    if (!closed && !pcLive()) status('error');
  };
  ws.onclose = () => {
    if (!closed && !pcLive()) status('disconnected');
  };

  return () => {
    closed = true;
    try {
      ws.close();
    } catch (_) {}
    try {
      pc.close();
    } catch (_) {}
  };
}

// ICE gathering 이 끝날 때까지(최대 3s) 대기. 로컬 host 후보는 즉시 모임.
function waitIceComplete(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
    setTimeout(resolve, 3000); // 안전망
  });
}
