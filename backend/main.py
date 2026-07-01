"""
로봇 운영 백엔드 (Robotics platform backend).

역할:
- rclpy 로 ROS 토픽(/odom)을 구독해 다중 로봇 상태를 메모리에 유지
- throttle: 이력(history)은 ~10Hz 로만 저장 (브라우저 부담 완화)
- REST:  GET /api/robots            현재 로봇들의 최신 상태
         GET /api/robots/{id}/history  로봇 위치 이력
- WS:    /ws  실시간 상태 push (10Hz) + 대시보드 명령 수신 → /cmd_vel 발행

프론트(React)는 rosbridge 에 직접 붙지 않고 이 백엔드에만 붙는다.
=> "UI만" 이 아니라 "운영 소프트웨어 계층"을 담당함을 보여주는 구조.
"""
import asyncio
import json
import math
import threading
import time
from collections import deque
from contextlib import asynccontextmanager

import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry
from geometry_msgs.msg import Twist

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware


class RobotState:
    def __init__(self):
        self.latest = None
        self.history = deque(maxlen=600)  # ~60초 @10Hz


class BridgeNode(Node):
    """ROS 구독/발행 + 상태 집계 담당 ROS 노드."""

    def __init__(self):
        super().__init__('dashboard_backend')
        self.robots = {}  # robot_id -> RobotState
        self._last_store = 0.0
        self.create_subscription(Odometry, '/odom', self.on_odom, 10)
        self.cmd_pub = self.create_publisher(Twist, '/cmd_vel', 10)
        self.get_logger().info('dashboard_backend up: /odom 구독, /cmd_vel 발행')

    def on_odom(self, msg: Odometry):
        rid = 'robot1'  # 단일 로봇 데모. 다중 로봇이면 네임스페이스로 구분.
        st = self.robots.setdefault(rid, RobotState())
        p = msg.pose.pose.position
        t = msg.twist.twist
        o = msg.pose.pose.orientation
        yaw = 2.0 * math.atan2(o.z, o.w)  # 평면(2D) 로봇 heading
        data = {
            'id': rid,
            't': time.time(),
            'x': p.x, 'y': p.y,
            'vx': t.linear.x, 'wz': t.angular.z,
            'yaw': yaw,
        }
        st.latest = data
        # throttle: 이력은 10Hz 로만
        now = time.time()
        if now - self._last_store >= 0.1:
            st.history.append({'t': data['t'], 'x': p.x, 'y': p.y})
            self._last_store = now

    def send_cmd(self, linear: float, angular: float):
        msg = Twist()
        msg.linear.x = float(linear)
        msg.angular.z = float(angular)
        self.cmd_pub.publish(msg)


node: BridgeNode | None = None


def ros_thread():
    global node
    rclpy.init()
    node = BridgeNode()
    rclpy.spin(node)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ROS 노드는 별도 스레드에서 spin (uvicorn 이벤트루프와 분리)
    threading.Thread(target=ros_thread, daemon=True).start()
    yield


app = FastAPI(title="ROS Dashboard Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


def robot_states():
    if node is None:
        return []
    return [st.latest for st in node.robots.values() if st.latest]


@app.get("/api/robots")
def list_robots():
    return robot_states()


@app.get("/api/robots/{robot_id}/history")
def history(robot_id: str):
    if node is None or robot_id not in node.robots:
        return []
    return list(node.robots[robot_id].history)


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()

    async def receiver():
        # 대시보드 → 백엔드 명령 (Teleop)
        try:
            while True:
                raw = await websocket.receive_text()
                cmd = json.loads(raw)
                if cmd.get("type") == "cmd_vel" and node:
                    node.send_cmd(cmd.get("linear", 0.0), cmd.get("angular", 0.0))
        except WebSocketDisconnect:
            pass

    recv = asyncio.create_task(receiver())
    try:
        # 백엔드 → 대시보드 상태 push (10Hz)
        while True:
            await websocket.send_text(json.dumps({"type": "robots", "data": robot_states()}))
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        pass
    finally:
        recv.cancel()
