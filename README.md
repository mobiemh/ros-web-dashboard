# ROS Web Dashboard

ROS(로봇)의 실시간 데이터를 브라우저에서 모니터링하고 원격 제어하는 웹 대시보드.
가장 대중적인 스택으로 구성했습니다.

## 스택

| 계층 | 기술 | 비고 |
|------|------|------|
| 프론트 | **React + Vite** | 표준 SPA 조합 |
| ROS 연동 | **roslib (roslibjs)** | rosbridge WebSocket 클라이언트 |
| ROS 서버 | **rosbridge_suite** | ROS1/2 공식, JSON over WebSocket |

```
[ROS 노드/시뮬] ─ rosbridge_server(:9090) ─ WebSocket ─ [roslib] ─ React 대시보드
```

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
```

기본으로 **Demo data** 가 켜져 있어 ROS 없이도 대시보드가 움직입니다(원운동 가짜 /odom).
UI/스크린샷 확인용으로 바로 쓰세요.

## 실제 ROS 에 연결

### 방법 A — Docker (추천, ROS 설치 불필요)

웹 대시보드는 GUI(Gazebo 화면)가 필요 없으므로, rosbridge + 가짜 로봇 노드를
컨테이너로 headless 하게 띄우는 게 제일 깔끔합니다. Docker Desktop 만 있으면 됩니다.

```bash
docker compose up --build      # rosbridge(:9090) + fake_robot 기동
```

그리고 대시보드에서 **Demo data** 체크 해제 → `ws://localhost:9090` **Connect**.
`docker/fake_robot.py` 가 /odom 을 쏘고 /cmd_vel(Teleop)을 받으므로,
실물 로봇 없이도 브라우저 ↔ rosbridge ↔ ROS 노드 전체 경로가 동작합니다.

### 방법 B — WSL2 네이티브 설치 (Gazebo GUI 까지 볼 때)

```bash
# ROS 2 (Ubuntu/WSL2)
sudo apt install ros-humble-rosbridge-suite
ros2 launch rosbridge_server rosbridge_websocket_launch.xml   # :9090
# (예시 로봇) TurtleBot3 Gazebo
export TURTLEBOT3_MODEL=burger
ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py
```

> Windows 의 Docker Desktop 도 내부적으로 WSL2 를 백엔드로 씁니다.
> 즉 "Docker vs WSL2" 가 아니라 "컨테이너로 감싸느냐 / 직접 설치하느냐" 의 차이입니다.
> 대시보드 개발에는 GUI 가 필요 없으니 **방법 A(Docker headless)** 가 가장 간편합니다.

### ROS 1 을 쓴다면
`src/ros/topics.js` 의 messageType 에서 `/msg/` 를 빼세요.
예: `nav_msgs/msg/Odometry` → `nav_msgs/Odometry`

## 구조

```
src/
├─ ros/
│  ├─ useRos.js      # 연결 관리(자동 재연결) + subscribe/advertise + 데모 모드
│  └─ topics.js      # 구독/발행 토픽 정의 (여기만 바꾸면 됨)
├─ components/
│  ├─ ConnectionBar  # 연결 상태 + 데모 토글
│  ├─ OdomStats      # /odom → 위치·속도 카드
│  ├─ PoseCanvas     # /odom → 실시간 궤적 캔버스
│  └─ Teleop         # /cmd_vel → 원격 조작
└─ App.jsx
```

## 확장 아이디어 (포트폴리오 심화 포인트)

- 다중 로봇: 네임스페이스(`/robot1/odom`)별 위젯
- `/scan` LaserScan 시각화 (장애물)
- `web_video_server` 로 카메라 스트림 `<img>` 표시
- 메시지 rate/지연 표시, 재연결 UX, 백프레셔 처리
- 목적지 클릭 → Nav2 goal 전송
