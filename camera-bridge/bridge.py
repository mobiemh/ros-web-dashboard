#!/usr/bin/env python3
"""
ROS 2 카메라 → WebRTC 브리지 (aiortc)

/camera/image_raw (sensor_msgs/Image) 를 구독해, 브라우저에 WebRTC 로 실시간 스트리밍한다.
webrtc_ros(크로미움 libwebrtc 소스 빌드) 대신 순수 파이썬 aiortc 를 써서 빌드 지옥을 피한다.
이는 로보틱스 실무에서 흔한 패턴(ROS 카메라 → aiortc/Pion 자체 브리지 → 브라우저)이다.

시그널링 (WebSocket, /webrtc):
  - 브라우저 → { "type": "offer",  "sdp": ... }
  - 브리지  → { "type": "answer", "sdp": ... }
  ICE 는 non-trickle: 양쪽 다 gathering 을 끝낸 뒤 SDP 에 후보를 담아 교환한다.
  (localhost/동일 호스트에선 host 후보만으로 충분 → 트리클/ICE 별도 메시지 불필요, 구현 단순.)

환경변수:
  CAMERA_TOPIC   구독할 이미지 토픽 (기본 /camera/image_raw)
  BRIDGE_PORT    시그널링/HTTP 포트 (기본 8080)
"""
import asyncio
import json
import os
import threading

import numpy as np
from aiohttp import web
from av import VideoFrame

import logging

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image

# ICE/WebRTC 협상 디버그: DEBUG_ICE=1 이면 aioice/aiortc 상세 로그(어느 후보/체크에서 막히는지)
if os.environ.get("DEBUG_ICE"):
    logging.basicConfig(level=logging.DEBUG, format="%(name)s %(levelname)s %(message)s")
    for _n in ("aioice", "aiortc"):
        logging.getLogger(_n).setLevel(logging.DEBUG)

from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.mediastreams import VideoStreamTrack

CAMERA_TOPIC = os.environ.get("CAMERA_TOPIC", "/camera/image_raw")
BRIDGE_PORT = int(os.environ.get("BRIDGE_PORT", "8080"))

# --- Docker/NAT 뒤 WebRTC 미디어 전달용 (Windows Docker Desktop 등) ---
# aioice 는 ICE UDP 를 랜덤 포트로 바인딩하고 컨테이너 내부 IP(172.x)를 후보로 광고한다.
# 그러면 호스트 브라우저가 미디어(UDP)에 못 닿는다. 두 가지로 해결:
#   WEBRTC_UDP_PORT  : ICE UDP 를 이 고정 포트로 바인딩 → compose 에서 /udp 퍼블리시 가능
#   WEBRTC_PUBLIC_IP : answer 의 host 후보 IP 를 이 값(예: 127.0.0.1)으로 치환 → 브라우저가 닿음
WEBRTC_UDP_PORT = int(os.environ.get("WEBRTC_UDP_PORT", "0"))   # 0 = 비활성(랜덤)
WEBRTC_PUBLIC_IP = os.environ.get("WEBRTC_PUBLIC_IP", "")        # "" = 치환 안 함

# ICE UDP 를 고정 포트로: asyncio 의 create_datagram_endpoint 에서 port 0 요청을 고정 포트로 치환.
# (mdns 는 5353, TURN 미사용이라 port==0 인 건 ICE host 후보 소켓뿐 → 안전하게 구분됨.)
if WEBRTC_UDP_PORT:
    import asyncio.base_events as _abe

    _orig_cde = _abe.BaseEventLoop.create_datagram_endpoint

    async def _cde(self, protocol_factory, *args, local_addr=None, **kwargs):
        if local_addr and len(local_addr) == 2 and local_addr[1] == 0:
            # 0.0.0.0 로 바인딩해야 Docker 퍼블리시 포트로 포워딩된 UDP 가 들어온다.
            # (특정 컨테이너 IP 로 바인딩하면 docker-proxy 포워딩 패킷을 못 받아 브라우저 체크 유실)
            # 후보 host 는 munge_sdp_ip 가 WEBRTC_PUBLIC_IP 로 바꿔주므로 0.0.0.0 이어도 무방.
            local_addr = ("0.0.0.0", WEBRTC_UDP_PORT)
        return await _orig_cde(self, protocol_factory, *args, local_addr=local_addr, **kwargs)

    _abe.BaseEventLoop.create_datagram_endpoint = _cde


def extract_host_ipv4(offer_sdp: str) -> list:
    """offer 에서 브라우저의 host IPv4 후보 주소들을 뽑는다(.local mDNS/IPv6 제외)."""
    ips = []
    for line in offer_sdp.replace("\r\n", "\n").split("\n"):
        if line.startswith("a=candidate:") and " typ host" in line:
            p = line.split()
            if len(p) >= 6 and p[4].count(".") == 3 and p[4] not in ips:
                ips.append(p[4])
    return ips


def munge_sdp(sdp: str, target_ips: list) -> str:
    """answer 의 host 후보를 target_ips(브라우저가 가진 IP들) × 고정 포트로 교체.
    브라우저는 자기 IP:포트로는 같은 인터페이스라 보낼 수 있고, 그 포트는 Docker 가
    0.0.0.0 에 퍼블리시했으니 컨테이너로 도달한다. (127.0.0.1 로 주면 LAN 바인딩 소켓이
    루프백으로 못 보내 체크가 유실됨 — 실측으로 확인.)"""
    if not target_ips or not WEBRTC_UDP_PORT:
        return sdp
    # 빈 줄과 기존 candidate 라인 제거(0.0.0.0 바인딩이라 aiortc 는 host 후보를 안 넣음)
    lines = [
        l
        for l in sdp.replace("\r\n", "\n").split("\n")
        if l != "" and not l.startswith("a=candidate:")
    ]
    cand = [
        "a=candidate:%d 1 udp %d %s %d typ host" % (i + 1, 2130706431 - i, ip, WEBRTC_UDP_PORT)
        for i, ip in enumerate(target_ips)
    ]
    out = []
    inserted = False
    for line in lines:
        if line.startswith("c=IN IP4 "):
            line = "c=IN IP4 " + target_ips[0]
        if line == "a=end-of-candidates" and not inserted:
            out.extend(cand)  # 합성 host 후보를 end-of-candidates 앞에 삽입
            inserted = True
        out.append(line)
    if not inserted:
        # end-of-candidates 가 없으면 ice-pwd 뒤에 후보+종료 삽입
        res, done = [], False
        for line in out:
            res.append(line)
            if line.startswith("a=ice-pwd:") and not done:
                res.extend(cand)
                res.append("a=end-of-candidates")
                done = True
        out = res if done else out + cand + ["a=end-of-candidates"]
    return "\r\n".join(out) + "\r\n"


class RosCamera(Node):
    """/camera/image_raw 를 구독해 최신 프레임 하나만 보관 (스트림 트랙이 여기서 당겨 씀)."""

    def __init__(self):
        super().__init__("webrtc_camera_bridge")
        self.latest = None  # (np.ndarray bgr24, W, H)
        self.count = 0
        self.create_subscription(Image, CAMERA_TOPIC, self._cb, 10)
        self.get_logger().info(f"subscribed to {CAMERA_TOPIC}")

    def _cb(self, msg: Image):
        h, w = msg.height, msg.width
        buf = np.frombuffer(bytes(msg.data), dtype=np.uint8)
        enc = msg.encoding.lower()
        try:
            if enc in ("rgb8", "bgr8"):
                img = buf.reshape(h, w, 3)
                if enc == "rgb8":
                    img = img[:, :, ::-1]  # RGB→BGR (aiortc VideoFrame 은 bgr24 기대)
            elif enc in ("mono8", "8uc1"):
                gray = buf.reshape(h, w)
                img = np.stack([gray] * 3, axis=-1)
            else:
                # 알 수 없는 인코딩: 3채널 가정으로 시도
                img = buf.reshape(h, w, -1)[:, :, :3]
        except ValueError:
            return  # 크기 불일치 프레임은 스킵
        self.latest = np.ascontiguousarray(img)
        self.count += 1


class CameraTrack(VideoStreamTrack):
    """aiortc 가 프레임을 요청하면 ROS 최신 프레임을 반환. 없으면 검은 화면."""

    def __init__(self, ros: RosCamera):
        super().__init__()
        self.ros = ros

    async def recv(self):
        pts, time_base = await self.next_timestamp()  # base class 가 ~30fps 로 페이싱
        img = self.ros.latest
        if img is None:
            img = np.zeros((480, 640, 3), dtype=np.uint8)
        frame = VideoFrame.from_ndarray(img, format="bgr24")
        frame.pts = pts
        frame.time_base = time_base
        return frame


pcs = set()


async def offer(request):
    """WS 시그널링: offer 받고 answer 반환."""
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    ros = request.app["ros"]
    pc = RTCPeerConnection()
    pcs.add(pc)

    @pc.on("connectionstatechange")
    async def on_state():
        print(f"[pc] state={pc.connectionState}")
        if pc.connectionState in ("failed", "closed"):
            await pc.close()
            pcs.discard(pc)

    async for raw in ws:
        if raw.type != web.WSMsgType.TEXT:
            continue
        msg = json.loads(raw.data)
        if msg.get("type") == "offer":
            # 브라우저가 가진 host IP 들 → answer 후보로 되돌려줌(같은 인터페이스라 브라우저가 보낼 수 있음)
            target_ips = extract_host_ipv4(msg["sdp"])
            if not target_ips and WEBRTC_PUBLIC_IP:
                target_ips = [WEBRTC_PUBLIC_IP]
            pc.addTrack(CameraTrack(ros))
            await pc.setRemoteDescription(RTCSessionDescription(sdp=msg["sdp"], type="offer"))
            answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            # non-trickle: gathering 완료까지 대기 후 SDP(후보 포함) 전송
            await _wait_ice_complete(pc)
            await ws.send_json({"type": "answer", "sdp": munge_sdp(pc.localDescription.sdp, target_ips)})
    await pc.close()
    pcs.discard(pc)
    return ws


async def _wait_ice_complete(pc):
    if pc.iceGatheringState == "complete":
        return
    done = asyncio.Event()

    @pc.on("icegatheringstatechange")
    def _():
        if pc.iceGatheringState == "complete":
            done.set()

    try:
        await asyncio.wait_for(done.wait(), timeout=5.0)
    except asyncio.TimeoutError:
        pass  # 부분 후보라도 진행


async def health(request):
    ros = request.app["ros"]
    return web.json_response({"topic": CAMERA_TOPIC, "frames": ros.count, "peers": len(pcs)})


def ros_spin(node):
    rclpy.spin(node)


def main():
    rclpy.init()
    ros = RosCamera()
    threading.Thread(target=ros_spin, args=(ros,), daemon=True).start()

    app = web.Application()
    app["ros"] = ros
    app.router.add_get("/webrtc", offer)
    app.router.add_get("/health", health)

    print(f"camera-bridge listening on :{BRIDGE_PORT}  (WS /webrtc, topic={CAMERA_TOPIC})")
    web.run_app(app, host="0.0.0.0", port=BRIDGE_PORT, print=None)


if __name__ == "__main__":
    main()
