# 개발 로그 (AI-assisted DEVLOG)

이 문서는 **AI와 함께 작업하며 나눈 대화를 근거로** 작성한다.
사실 그대로 남긴다: 어떤 결정을 AI가 제안했고, 나는 그것을 어떻게 이해·검증했으며,
무엇을 바꾸거나 반박했는지. **"내가 독자적으로 창안했다"고 과장하지 않는다.**

> 정직성 원칙: 이 프로젝트는 AI 보조로 만든다. 가치는 "AI가 짰다는 사실"이 아니라
> **"AI가 낸 것을 내가 이해하고, 대안과 비교하고, 검증해 책임진다"**는 데 있다.
> 아래 항목 중 "✅ 이해/검증됨"은 대화로 납득한 것, "⬜ 미검토"는 아직 내 논리로
> 방어할 수 없어 더 파야 하는 것이다. 면접 방어의 기준은 이 표식이다.

---

## 0. 프로젝트 개요

- **무엇**: ROS 연동 실시간 웹 대시보드. 로봇의 상태(위치·속도 등)를 브라우저에서
  모니터링하고, 원격으로 제어(Teleop)한다.
- **스택**: React + Vite(프론트) / roslibjs(ROS 클라이언트) / rosbridge(ROS↔웹 통역).
- **개발 방식**: AI로 뼈대를 빠르게 만들되, 각 결정을 이해·검증해 문서로 남긴다.

---

## 1. 학습 노트 (대화로 이해한 개념)

### ROS (Robot Operating System)  ✅
로봇 안 여러 프로그램(카메라/모터/센서/경로계획)이 **토픽**이라는 채널로 데이터를
주고받게 해주는 미들웨어. OS 가 아니라 "대화하는 판".

### 토픽 / 서비스 / 액션 (3가지 통신)  ✅
- **토픽**: 계속 흐르는 일방향 방송 (예 `/odom` 위치, `/cmd_vel` 속도명령). 응답 없음.
- **서비스**: 요청→응답 1회 (예 "지도 저장"). HTTP 요청과 유사.
- **액션**: 오래 걸리는 작업 + 진행 피드백 + 취소 (예 "저기로 이동"). 목적지 이동은 액션.
- 실무 감각: 다 토픽으로 처리하려는 게 초보 실수. 상황에 맞게 고른다.

### rosbridge  ✅
ROS 내부 통신(DDS)은 브라우저가 못 알아듣는다. rosbridge 가 ROS 토픽을
**WebSocket + JSON**(웹 표준)으로 통역해준다. 포트 9090. 브라우저↔ROS 양방향 통역사.

### roslib (roslibjs)  ✅
브라우저에서 rosbridge 와 대화하는 클라이언트 라이브러리. 코드의 `import ROSLIB`.

### ROS 1 vs ROS 2  ✅
- ROS 1: 중앙 마스터(roscore) 필수, 사실상 지원 종료(Noetic 2025-05 EOL).
- ROS 2: 마스터 없음(DDS 자동발견), 실시간성/보안 강화, Windows 지원. **신규는 ROS 2.**
- 실무 영향: 메시지 타입 표기가 다름(ROS1 `nav_msgs/Odometry` vs ROS2 `nav_msgs/msg/Odometry`),
  빌드도구·명령도 다름. 지원 전 회사가 어느 버전인지 확인해야 함.

### DDS  ✅
ROS 2 가 실제 통신에 쓰는 산업표준 배관. 마스터 없이 노드끼리 자동 발견,
**QoS**로 토픽별 통신 품질(신뢰성 vs 속도) 조절. 구현체 여럿(Fast DDS/Cyclone).
`ROS_DOMAIN_ID` 가 DDS 개념 — 같은 도메인끼리만 서로를 찾음.

### Gazebo 와 GUI  ✅
- Gazebo: 가상 로봇 시뮬레이터(물리 계산 + 진짜 ROS 토픽 발행).
- **gzserver**(엔진, 화면 없음) / **gzclient**(3D GUI 창).
- 대시보드는 토픽 데이터만 필요 → **GUI 불필요**. 그래서 headless 로 돌리면 됨.

### 실행 환경: Docker(headless) vs WSL2+WSLg  ✅
- 대시보드엔 GUI 가 필요 없으니 **Docker headless** 가 가장 간편·재현성 높음.
- Gazebo 3D 를 눈으로 보고 싶으면 **WSL2 + WSLg**(Windows 11 내장)로 GUI 시뮬.
- Windows Docker Desktop 도 내부적으로 WSL2 사용 → "Docker vs WSL2"가 아니라
  "컨테이너로 감싸느냐 / 직접 설치하느냐" 차이.

### WebRTC vs WebSocket (카메라 영상용)  ✅
데이터 성격에 따라 전송 방식이 갈린다. **섞지 않는 게 핵심.**
- **WebSocket(rosbridge)**: 서버 경유, TCP(신뢰성·순서 보장). odom/scan/cmd_vel 같은
  **작고 구조화된 데이터**에 적합. 지금 대시보드의 기본 경로.
- **WebRTC**: P2P·UDP·하드웨어 코덱, **저지연 미디어(영상·음성)**용. 카메라 영상에 적합.
- 카메라를 rosbridge(JSON)로 흘리면 `sensor_msgs/Image` 를 base64/JSON 인코딩 →
  **대역폭 폭증·지연**으로 실시간에 부적합. 그래서 카메라만 WebRTC 별도 경로.
- 실무: WebRTC 도 시그널링(연결 협상 SDP/ICE)은 보통 WebSocket 으로 한다.
  즉 **WebSocket 으로 악수시키고 WebRTC 로 영상을 흘린다.** (webrtc_ros 도 :8080/webrtc WebSocket 으로 시그널링)

### 발음: WebRTC "웹알티씨" / SFU "에스에프유" / STUN "스턴" / TURN "턴"  ✅

### 용어 발음  ✅
면접/대화에서 틀리면 티 남. 자주 쓰는 것 위주.
- **ROS** = "로스" (Ross 처럼 한 단어. "알오에스" 아님)
- **Gazebo** = 영어 "거지보우"(강세 가운데), 국내 통용 "가제보"
- **rosbridge** = "로스브릿지"
- **roslibjs** = "로스립JS" (줄여서 "로스립")
- 덤: rclpy "알씨엘파이" / rclcpp "알씨엘씨피피" / DDS "디디에스" / QoS "큐오에스"
  / Nav2 "내브투" / rviz "알비즈" / URDF "유알디에프" / gzserver·gzclient "지지서버·지지클라이언트"

---

## 1-1. 질문 · 학습 여정 (내가 던진 질문 순서)

> 만들면서 실제로 궁금해서 물어본 것들. 질문 → 배운 것. 모르는 걸 짚어가며 쌓은 흐름.

- **Q. ROS 로 웹 대시보드를 만들 수 있나?**
  → 가능. 표준 경로는 rosbridge + roslibjs. ROS 토픽을 브라우저에서 구독/발행.
- **Q. 대중적인 프레임워크로 짜면?**
  → React + Vite(프론트) + roslibjs + rosbridge 조합이 표준. 이 뼈대를 만듦.
- **Q. WSL2 에 ROS2 를 꼭 깔아야 하나? Docker 는 안 되나?**
  → Docker 로 됨. 대시보드는 GUI 가 필요 없어 오히려 headless Docker 가 더 깔끔.
    (rosbridge + 노드를 컨테이너로. Docker Desktop 도 내부적으로 WSL2 사용.)
- **Q. rosbridge 는 뭐고 ROS 는 뭐야?**
  → ROS = 로봇 프로그램들이 토픽으로 대화하는 판. rosbridge = ROS(DDS)를
    브라우저가 아는 WebSocket/JSON 으로 바꿔주는 통역사(:9090).
- **Q. Gazebo GUI 는 뭐지?**
  → Gazebo = 가상 로봇 시뮬레이터. gzserver(엔진, 데이터) / gzclient(3D GUI 창).
    대시보드는 토픽 데이터만 필요 → GUI 불필요. 그래서 headless 가능.
- **Q. 토픽 말고 서비스/액션은? ROS1 vs 2? DDS 는 정확히?**
  → 토픽(방송)·서비스(요청-응답)·액션(오래 걸림+피드백+취소)의 3가지 통신.
    ROS2 는 마스터 없는 최신 표준(ROS1 은 EOL). DDS = ROS2 의 실제 통신 배관
    (자동발견 + QoS). 위 "1. 학습 노트" 에 정리.
- **Q. GUI 가 있으면 더 재밌지 않나?**
  → 맞음. Windows11 내장 WSLg 로 WSL2 안 Gazebo 3D 창을 띄울 수 있음.
    `fake_robot.py` 자리에 Gazebo 를 넣으면 대시보드 코드 변경 없이 실물 시뮬 연결.
- **Q. ROS2 엔 C++ 가 필요한가? 언어 배우기 어렵나?**
  → C++/Python 둘 다 1급 지원(rclcpp/rclpy). 학습은 Python 권장. 언어보다
    "pub/sub 비동기·QoS·좌표계" 같은 로보틱스 사고방식이 진짜 학습곡선.
- **Q. WebRTC 가 뭐고 WebSocket·API 와 뭐가 달라?**
  → WebRTC=저지연 P2P 미디어(영상/음성), WebSocket=서버경유 실시간 데이터, API(REST)=요청-응답.
    **데이터=WebSocket, 미디어=WebRTC** 로 나눈다. (위 "1. 학습 노트" 정리)
- **Q. 그럼 이 대시보드에도 WebRTC 넣어야 하나?**
  → 지금 데이터(odom/scan)엔 **불필요**(rosbridge 가 더 맞음). **카메라 영상을 붙일 때만** 정당.
    → 카메라만 webrtc_ros 로 얹기로 결정(D-010).
- **Q. 실물 로봇 없이 가상 로봇으로 카메라도 되나?**
  → 됨. webrtc_ros 는 카메라 **토픽**만 있으면 소스가 실물이든 Gazebo 든 무관. Gazebo(waffle_pi)
    카메라 토픽으로 실물 없이 전 과정 실습 가능(D-009 와 같은 경로).

---

## 2. 설계 결정 (AI 제안 → 대화로 검증)

### D-001. 스택 — React + Vite + roslibjs + rosbridge  ✅ 이해/검증됨
- **대안 비교**: (a) rosbridge 직결  vs  (b) 자체 백엔드 브릿지(rclpy 등).
- **왜 (a)**: "대시보드 하나" 범위엔 부품이 적고 빠름. (b)는 서버에서 가공/인증/집계가
  가능하지만 지금은 과설계. 다중 로봇·인증·데이터 저장이 필요해지면 (b)로 전환.
- **상태**: 대화로 트레이드오프를 납득함. 면접에서 이 비교를 설명할 수 있음.

### D-002. 토픽 정의를 한 곳으로 추상화 (`src/ros/topics.js`)  ✅ 이해/검증됨
- **왜**: 토픽을 컴포넌트마다 하드코딩하면 유지보수·ROS1/2 전환이 어려움.
- **효과**: ROS1 로봇엔 이 파일의 `/msg/` 표기만 바꾸면 대응. "ROS1/2 양쪽 대응 설계"라는
  어필 포인트를 의도적으로 확보.

### D-003. ROS2 메시지 타입 표기 (`nav_msgs/msg/Odometry`)  ✅ 이해/검증됨
- **포인트**: 타입 문자열이 ROS 버전에 맞지 않으면 rosbridge 매칭이 안 될 수 있음.
  → ROS2 표기로 통일하고 주석에 ROS1 전환법 명시.
- **교훈**: AI 생성 타입 문자열은 대상 버전 기준으로 반드시 검증.

### D-004. 데모 모드 (ROS 없이 UI 구동)  ✅ 이해/검증됨
- **왜**: ROS/시뮬 없이도 UI 개발·스크린샷이 가능하도록. 컴포넌트 코드는 실제/데모 동일,
  전환은 체크박스. "백엔드 없이 프론트 독립 개발" 구조.

### D-005. 자동 재연결  ✅ 이해/검증됨
- **왜**: 로봇/네트워크는 상시 끊김. close 시 2초 후 재연결, 상태를 UI 에 노출.
  "끊기면 어떻게 복구?"에 대한 답.

### D-006. Docker headless 우선  ✅ 이해/검증됨
- **판단**: 대시보드엔 Gazebo GUI 불필요 → rosbridge + `fake_robot.py` 를 컨테이너로.
- **확장**: 물리 시뮬 필요 시 `fake_robot.py` 자리에 Gazebo(gzserver) 투입.
  대시보드 코드 불변(D-002 추상화 덕분).

### D-007. 로봇 3D 시각화 — 웹 3D 뷰 채택 (Gazebo GUI 아님)  ✅ 이해/검증됨 (구현은 TODO)
- **선택지**: (a) Gazebo GUI(gzclient)  vs  (b) 웹 대시보드 안 3D 뷰(ros3djs/three.js).
- **왜 (b) 웹 3D**:
  - Gazebo GUI 는 **남이 만든 툴**이라 내 실력 증명 X, 호스트/GPU 의존(재현성 낮음),
    Gazebo 쓸 때만 유효(실물 로봇엔 없음), 원격 접속 어려움.
  - 웹 3D 는 **내가 만든 제품** + **OS 독립·원격 접속** + **실물 로봇에도 동작**(같은 토픽).
    프로젝트 주제(웹 대시보드)와도 일치. → 재미·재현성·포트폴리오 가치 모두 확보.
  - 용도 자체가 다름: Gazebo GUI = 시뮬 디버깅(원본 진실), 웹 3D = 모니터링 제품(재구성).
    개발 중엔 Gazebo GUI(WSL2+WSLg)로 잠깐 확인, 결과물은 웹 3D 로 승부.
- **실무 사용성**: 웹 3D 는 실제로 쓰임 — **Foxglove**(WebGL 기반), Cruise 의 **Webviz**,
  원격조종·플릿 관제 대시보드 등.
- **한계와 우회 (핵심 설계 포인트)**:
  - 브라우저 한계는 **고대역폭 raw 데이터**(포인트클라우드·다중 카메라)와 **실시간 제어**.
  - 전송(WebSocket)은 문제 아님. **진짜 병목은 rosbridge 기본 JSON 직렬화**(부피·파싱).
  - 해결: **CBOR/압축 인코딩 + throttle_rate + 백엔드 다운샘플(D-001 백엔드 브릿지) +
    무거운 건 전용 채널(web_video_server/WebRTC) + 파싱을 Web Worker 로**.
  - WebSocket 이 "양"을 줄여주진 않음 → 소스에서 throttle 필수(안 하면 큐 적체·지연).
- **면접 한 줄**: "전송은 WebSocket 으로 충분하지만 rosbridge 기본 JSON 이 고빈도
  데이터에서 병목이라, CBOR 인코딩·throttle 을 쓰고 무거운 데이터는 백엔드에서
  다운샘플해 보낸다. 실시간 제어는 브라우저가 아니라 로봇 쪽에서 돈다."
- **구현 계획**: 현재 `/odom`(가벼움)은 JSON WebSocket 으로 문제 없음. 3D 뷰는 추후 추가하되,
  무거운 데이터가 붙는 시점에 **백엔드 브릿지 버전**으로 설계 → "한계 인식 + 백엔드 우회"
  스토리 강화.

### D-008. 아키텍처 확장 — 백엔드 브릿지 (풀스택 운영 시스템)  ✅ 구현·검증됨
- **배경**: 프론트(UI)만이면 로봇 분야에서 주변부. "운영 소프트웨어 계층을 책임지는
  SW 엔지니어"를 증명하려면 백엔드가 필요 → 정체성을 "웹개발자"가 아니라
  "로봇 도메인 아는 소프트웨어 엔지니어"로.
- **구조**:
  `[fake_robot/Gazebo] ─ROS─ [FastAPI+rclpy 백엔드] ─REST/WS─ [React 대시보드]`
  백엔드 역할: ROS 구독(rclpy) / throttle(이력 10Hz) / 다중로봇 상태·이력 버퍼 /
  REST(GET /api/robots, /history) + WebSocket(/ws 실시간 push) / 대시보드 명령 → /cmd_vel.
- **프론트 3모드 통합**: demo / rosbridge / backend 를 **같은 인터페이스**(subscribe/advertise)로
  → 컴포넌트 코드 불변(D-002 추상화의 실제 이득). 모드는 드롭다운으로 전환.
- **왜 rclpy 백엔드**: aggregation/throttle/history 를 서버에서 처리 → 브라우저 부담↓
  (D-007 한계 우회). "로봇 엔지니어가 대충 짜던 SW 를 제대로 만든다"의 증거.
- **두 모드 profile**: `--profile direct`(rosbridge 직결) / `--profile platform`(백엔드 경유)
  → 아키텍처 트레이드오프 시연(D-001).
- **검증(2026-07-01)**: `docker compose --profile platform up` → `GET /api/robots` 가
  robot1 위치·속도 반환 확인. Vite dev server → 브라우저에서 backend 모드 동작 확인.

### D-009. 진짜 Gazebo(TurtleBot3) 시뮬 연동 — WSL2 + WSLg  ✅ 구현·검증됨
- **배경**: `fake_robot`(가짜 노드) 대신 **실제 ROS 시뮬(Gazebo)** 로 교체 →
  "가짜 데이터"에서 "진짜 시뮬레이션 연동"으로 신뢰도↑ + 데모영상.
- **구성**: Windows11 WSL2(Ubuntu 22.04) + WSLg(GUI) 에 ROS 2 Humble + Gazebo + TurtleBot3 +
  rosbridge 설치([scripts/wsl-setup-ros.sh](scripts/wsl-setup-ros.sh)). Gazebo 가 /odom·/scan 발행,
  /cmd_vel 구독. 대시보드는 **rosbridge 직결 모드**로 접속.
- **핵심 이득**: `fake_robot` → Gazebo 로 바꿔도 **대시보드 코드 불변**(둘 다 같은 /odom·/cmd_vel
  토픽 계약). D-002 추상화가 실제로 값을 함.
- **검증(2026-07-01)**: `ros2 topic echo /odom` 실제 데이터 확인, 그리고 대시보드와 동일 경로
  (Node WS → rosbridge:9090 → /odom)로 격리 테스트 → `x=-2.000 y=-0.500` 수신 확인.
- **GUI**: WSLg 로 Gazebo 3D 창 표시. WSLg 에서 GL 불안정 → `LIBGL_ALWAYS_SOFTWARE=1`
  (느리지만 확실).

### T-003. Gazebo spawn_entity 실패 (/spawn_entity 서비스 30초 타임아웃)
- **증상**: `Service /spawn_entity unavailable. Was Gazebo started with GazeboRosFactory?`
  → 로봇 스폰 실패. gzserver 는 떴는데 서비스가 안 올라옴.
- **원인**: Gazebo 가 **온라인 모델 DB 접속으로 hang** (WSL 네트워크에서 흔함) → gzserver 초기화
  지연 → 30초 내 서비스 등록 실패.
- **해결**: `export GAZEBO_MODEL_DATABASE_URI=""` 로 온라인 모델 DB 차단 → 즉시 정상 스폰.

### T-004. `pkill -9 -f gzserver` 가 자기 자신을 죽임 (exit 9)
- **증상**: gazebo 프로세스 정리하려 `pkill -9 -f gzserver` 실행 시 명령이 출력 없이 exit 9(SIGKILL).
- **원인**: `-f` 는 **전체 커맨드라인**을 매칭 → 실행 중인 bash 명령줄에 "gzserver" 문자열이 있어
  **자기 자신도 매칭**해 SIGKILL. (isolation 디버깅의 반례: 도구가 자신을 죽임)
- **해결**: `kill -9 $(pgrep -x gzserver)` — **정확한 프로세스명(-x)** 으로만 매칭.

### D-010. 카메라 실시간 영상 — WebRTC 별도 경로 (webrtc_ros 시도 → aiortc 전환)  ✅ 실영상 검증됨
- **문제**: 로봇 카메라 영상을 대시보드에 붙이고 싶다. 기존 rosbridge(JSON) 로 나를까?
- **대안 비교**:
  - (a) rosbridge 로 `sensor_msgs/Image` 전송 → base64/JSON 이라 대역폭·지연 폭증. **탈락.**
  - (b) `web_video_server`(MJPEG): `<img>` 한 줄로 가장 쉬움. 지연 중간·대역폭 큼 → 상태 확인용.
  - (c) WebRTC: 저지연·고효율. 원격 조종에 적합. **← 채택(미디어 성격상 정석)**
  - (d) FastAPI(D-008) 중계: 인증·녹화·다중 클라이언트에 유리, 서버 부하·지연 ↑.
- **왜 WebRTC**: "저지연 원격 조종" 목표 + 미디어 성격. 텔레메트리(odom/scan)는 rosbridge
  그대로 두고 **카메라만** WebRTC 별도 경로 → 관심사 분리.
- **WebRTC 구현체 선택의 반전 (AI 제안 → 조사 → 방향 수정, 이 프로젝트 정직성 원칙의 실례)**:
  - 처음엔 ROS 표준격인 **`webrtc_ros`(RobotWebTools)** 로 가기로 하고 클라이언트까지 작성.
  - 그런데 실제 저장소를 열어 조사하니: **ROS2 브랜치(`develop-ros2`)가 3년 반 방치**
    (마지막 커밋 2023-01, 총 6커밋), **ROS2 CI 없음**, Dockerfile 이 `catkin_make_isolated`
    (ROS1 도구)로 **미완성**, 게다가 `webrtc` 패키지가 **크로미움 libwebrtc(M108)를 소스
    빌드**(depot_tools+GN, 수 시간·수 GB, 최신 22.04 툴체인과 불일치로 깨짐).
  - "Docker 로 Foxy 맞추면?" 도 검토했으나 **프리빌트 이미지 없음** + 제공 Dockerfile 은
    ROS1 용 → Docker 여도 결국 **직접 포팅**이 됨. 즉 "빌드가 느린" 문제가 아니라
    **업스트림 자체가 방치·미완성**이라는 게 핵심.
  - **결론: `aiortc`(순수 파이썬 WebRTC) 로 자체 브리지**. pip 설치로 끝, libwebrtc 빌드 없음.
    "ROS 카메라 → aiortc/Pion 자체 브리지 → 브라우저" 는 로보틱스 실무의 흔한 패턴이라
    타협이 아니라 **실무 표준 접근**. (실무는 프로토콜을 새로 짜지 않고 구현체
    libwebrtc/aiortc/Pion 을 쓰고, 다자간은 mediasoup/LiveKit 등 기성 SFU 를 쓴다.)
- **설계 원칙**: 기존 `useRos`(subscribe/advertise) 추상화를 **건드리지 않음**. 카메라는
  rosbridge 가 아니라 WebRTC 라, `mode` 만 보고 소스를 스스로 고르는 독립 컴포넌트
  (`CameraView`)로 분리. (D-002 추상화를 오염시키지 않으려는 의도적 선택.)
- **추가·변경 코드**:
  - `camera-bridge/bridge.py`(신규): aiortc 브리지. `/camera/image_raw` 구독 → WebRTC 스트리밍,
    WS 시그널링(/webrtc, non-trickle offer/answer). ROS 노드는 별도 스레드에서 spin.
  - `camera-bridge/Dockerfile` · `requirements.txt` · `sim.Dockerfile`(Gazebo waffle_pi 헤드리스).
  - `docker-compose.camera.yml`(신규): sim + camera-bridge 를 같은 Humble/네트워크로.
  - `src/ros/topics.js`: `camera`(`/camera/image_raw`) 추가 + rosbridge 로 안 나르는 이유 주석.
  - `src/ros/webrtcRos.js`(신규): 브리지 클라이언트. recvonly offer → ICE 완료 대기 → answer → ontrack.
  - `src/components/CameraView.jsx`(신규): demo=웹캠(getUserMedia) / rosbridge·backend=aiortc 브리지.
  - `src/App.jsx`: `CameraView` 삽입, `cameraUrl`(`ws://localhost:8080/webrtc`), 안내 문구.
  - `src/styles.css`: `.camera-frame`(16:9) 등.
- **왜 Humble (Foxy 아님)**: aiortc 는 libwebrtc 빌드가 없어 Foxy 를 고집할 이유가 사라짐.
  → Gazebo 가 도는 **Humble 로 통일**해 DDS interop 을 깨끗하게. (webrtc_ros 였다면 Foxy 강제였음.)
- **검증(2026-07-03)**:
  - ✅ Gazebo waffle_pi → `/camera/image_raw` **20~22Hz, sensor_msgs/msg/Image** 발행 확인.
  - ✅ **WSL 경로**: 브리지가 프레임 수신. 헤드리스 aiortc 클라이언트로
    offer→answer→**ICE completed**, **640x480 비디오 10프레임 수신**(실영상 흐름 증명).
  - ✅ **Docker 경로(컨테이너간)**: `docker compose -f docker-compose.camera.yml up` → sim 컨테이너
    Gazebo → DDS → bridge 컨테이너 → aiortc 클라이언트로 **640x480, ICE completed** 재확인.
  - ✅ **Windows 브라우저(Chrome)에서 실영상**: chrome://webrtc-internals 로 **framesDecoded 30fps,
    640x480, VP8(libvpx), packetsLost 0, freezeCount 0** 확인 — Docker on Windows 에서 완주.
  - ✅ Teleop 버튼으로 로봇 조종 + odom/scan 텔레메트리 표시(rosbridge 서비스 추가 후).
  - ✅ `npm run build` 통과.
- **Windows Docker Desktop WebRTC 미디어 뚫기(해결)**: 처음엔 "vpnkit UDP 한계라 불가"로 오판했으나,
  UDP 에코 테스트로 **왕복이 됨을 실측** → 원인은 아래 3가지였고 순서대로 해결:
  1. aiortc 가 **랜덤 UDP 포트** 사용 → 고정 포트(`WEBRTC_UDP_PORT`)로 바인딩 + compose `/udp` 퍼블리시.
  2. aiortc 가 **컨테이너 특정 IP(172.x)에 바인딩** → docker-proxy 포워딩 패킷 유실 → **0.0.0.0 바인딩**.
  3. **후보 IP 를 127.0.0.1 로 주니 브라우저가 못 보냄**(LAN 바인딩 소켓 → 루프백 전송 불가) →
     **offer 의 브라우저 host IP 들을 answer 후보로 되돌려줌** → 브라우저가 자기 IP:포트로 전송
     → Docker 가 0.0.0.0 퍼블리시로 수신. ← **결정타**(chrome://webrtc-internals 로 원인 특정).
- **회색 프레임(해결)**: WebRTC 는 완벽한데 화면이 회색 → 프레임 픽셀 `std=1.86`(균일) 확인 →
  Gazebo `GAZEBO_MODEL_PATH` 미설정으로 **model://sun(광원) 미로드** → 빈 하늘만 렌더. `sim-entrypoint.sh`
  에서 gazebo setup 소싱 + 모델경로 지정 → sun/ground_plane 로드 → **실제 장면 렌더**.
- **기타 함정(해결)**: `xvfb-run` 을 PID1 CMD 로 쓰면 Xvfb 만 뜨고 `ros2 launch` 를 exec 못 해 멈춤
  (프로세스 트리·빈 docker logs 로 확인) → Xvfb 직접 기동 후 `exec` 하는 `sim-entrypoint.sh`.
- **추가 코드**: `camera-bridge/sim-entrypoint.sh`(헤드리스 Gazebo+조명), `rosbridge.Dockerfile`(:9090
  텔레메트리/제어 중계), `docker-compose.camera.yml` 에 sim/rosbridge/camera-bridge 3서비스.
- **정직성 메모**: "AI 가 webrtc_ros 를 제안 → 내가 저장소를 열어 방치·미완성 확인 → 실무 표준 aiortc 로
  전환 → Windows Docker WebRTC 3대 난관을 **추측 아닌 실측(UDP 에코·chrome://webrtc-internals·픽셀
  통계)으로** 하나씩 규명·해결 → 실영상+조종 완주". 특히 "vpnkit 한계라 불가"라는 **내 초기 오판을
  실측이 뒤집은 것**이 핵심 교훈. (질문 주도 디버깅 상세는 아래 부록.)

#### D-010 부록. 실행 방법 (두 경로)
카메라 소스는 **Gazebo 가상 로봇**(실물 불필요). 텔레메트리(odom/scan)는 rosbridge, 카메라는 브리지.

**경로 A — WSL 직결 (Windows 로컬에서 실제로 영상 보는 검증된 길)**
```bash
export TURTLEBOT3_MODEL=waffle_pi
# 터미널 A: Gazebo (softwareGL) — /odom /scan /camera/image_raw 발행
LIBGL_ALWAYS_SOFTWARE=1 GAZEBO_MODEL_DATABASE_URI="" \
  ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py
# 터미널 B: 텔레메트리 rosbridge (:9090)
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
# 터미널 C: 카메라 aiortc 브리지 (:8080)  — pip install aiortc aiohttp av numpy
python3 camera-bridge/bridge.py
# 터미널 D: 대시보드 → 'rosbridge 직결' 모드
npm run dev
```

**경로 B — Docker (Windows Docker Desktop 에서도 브라우저 실영상까지 검증됨)**
```bash
docker compose -f docker-compose.camera.yml up --build
# 3서비스: sim(Gazebo) + rosbridge(:9090, 텔레메트리/제어) + camera-bridge(:8080/webrtc + 50000/udp)
# 대시보드(npm run dev) → 'rosbridge 직결' 모드 → 카메라 영상 + 위치/속도 + 버튼 조종
```
- WebRTC 미디어(UDP)는 위 "뚫기(해결)" 3수정(고정포트+0.0.0.0+브라우저IP후보)으로 Windows 에서도 도달.
- 확인: `ros2 topic hz /camera/image_raw`, `curl :8080/health`, chrome://webrtc-internals framesDecoded.

#### D-010 부록2. 질문 주도 디버깅 여정 (내 질문 → 발견 → 조치)

> Windows Docker Desktop 에서 카메라 WebRTC 를 뚫은 과정. **내가 던진 질문이 매 단계 방향을 틀었고,
> AI 의 초기 추측(오판 포함)을 실측으로 뒤집으며 원인을 좁혔다.** 순서 자체가 디버깅 방법론이다.

1. **Q. "WSL 말고 도커로 하면 해결되겠네?"** → Docker 로 방향 고정. AI 가 "Foxy 맞추면"을 검토했지만
   webrtc_ros 업스트림 방치라 무의미 → aiortc 로 확정.
2. **Q. "그냥 웹소켓 연결이 안 되는 거 아냐?"** → 브리지 `peers=1` 확인 → **WS(시그널링)는 됨**, 문제는
   그 다음 미디어(ICE)임을 분리. (헛다리 하나 제거.)
3. **Q. "ws://9090 이 연결 안 되네?"** → `:9090`=rosbridge(텔레메트리)로 카메라(:8080)와 **별개 소켓**임을
   명확화 → 나중에 rosbridge 서비스 추가의 근거.
4. **Q. "같은 도커 브릿지 네트워크로 구성하면?"** → 컨테이너↔컨테이너는 이미 됨(sim↔bridge). **브라우저는
   호스트에 있어 그 네트워크 밖**이라는 핵심 구분 도출.
5. **Q. "이렇게 확인 안 하나?"(추측 말고 측정하라)** → **UDP 에코 테스트** 실행 → Windows↔컨테이너 UDP
   왕복이 **된다**는 실측 → AI 의 "vpnkit 이 UDP 를 막는다"는 **오판을 폐기**. 원인은 WebRTC 쪽으로 좁혀짐.
6. (측정) **chrome://webrtc-internals + aioice DEBUG 로그** → 컨테이너→브라우저 체크는 SUCCEEDED 인데
   브라우저→컨테이너 체크(`< REQUEST`)가 안 옴 → **후보 IP(127.0.0.1)로는 브라우저 LAN 소켓이 못 보냄**을
   규명 → **브라우저 자신의 IP 를 후보로** 되돌려주는 결정타 수정.
7. **Q. "connected 됐는데 회색 화면 / 주는 게 회색 프레임인가봐"** → **프레임 픽셀 통계**(std=1.86 균일)로
   "파이프라인 OK, 소스가 회색" 확정 → Gazebo **sun(광원) 미로드**(GAZEBO_MODEL_PATH) 발견·수정 → 실영상.
8. **Q. "버튼 눌러도 안 움직이네?"** → 조종(/cmd_vel)은 rosbridge(:9090) 경유인데 미기동 → **rosbridge
   서비스 추가** → 조종+텔레메트리 완성.

**교훈**: ① "웹소켓? 9090? 같은 네트워크?" 같은 내 질문이 **문제를 계층별로 갈라** 헛다리를 빠르게 제거했다.
② "이렇게 확인 안 하나"가 **추측→측정** 전환점이었고, AI 의 vpnkit 오판을 UDP 에코 실측이 뒤집었다.
③ 회색 화면도 "코덱? 연결?"이 아니라 **픽셀 통계**라는 측정으로 소스 문제임을 곧장 짚었다.
→ 결국 **모든 결정을 로그·에코·픽셀·webrtc-internals 로 측정해 내렸고, 그게 방어 가능한 근거**다.

> 참고: D-001~D-010 은 AI 가 스캐폴딩·설명하며 제안한 것을, 대화(개념 설명 + 트레이드오프
> 비교)를 거쳐 내가 이해·동의한 결정이다. 독자적 창안이 아니라 "검증·수용"이 정확한 표현.

---

## 3. 트러블슈팅 (막힌 것 + 해결)

<!-- 실제로 겪은 것만. 특히 AI 제안이 틀렸고 내가 잡은 사례를 남긴다. -->

### T-001. Teleop 버튼 무반응 → 계층 격리 검증으로 원인 규명
- **증상**: 대시보드 방향버튼(Teleop)을 눌러도 로봇이 반응 없음.
- **디버깅(계층 격리)**: 프론트→WS→백엔드→ROS→로봇 사슬에서 어디가 문제인지 모름.
  → **프론트를 건너뛰고** 스크립트로 백엔드 `/ws` 에 직접 cmd_vel(정지) 전송 →
  `GET /api/robots` 에서 로봇 속도가 0 으로 바뀜 확인.
  ⇒ WS·백엔드·ROS·로봇 계층은 정상. 문제는 건너뛴 **프론트(모드)** 에 있음.
- **원인**: Demo 모드였음. Demo 는 조종할 로봇이 없어 명령이 console.log 로만 감.
  (백엔드 모드로 바꾸니 정상 동작.)
- **교훈**: 여러 계층이 엮인 시스템은 **한 계층만 떼어내 테스트**해 정상/이상을 갈라
  범위를 좁힌다(isolation 검증). 전체를 무작정 재시도하지 않는다.

### T-002. ◀▶ 회전 시 로봇이 안 움직이는 것처럼 보임
- **증상**: ▲▼(직진)는 되는데 ◀▶(회전)는 화면 변화 없음.
- **원인**: ◀▶ 는 angular 속도만(linear=0) → 차동구동 로봇은 **제자리 회전**이라 x,y 불변.
  대시보드가 위치만 그리고 **방향(heading)을 안 그려서** 안 움직이는 것처럼 보임(정상 동작).
- **해결**: 백엔드가 odom 쿼터니언에서 yaw 를 계산해 전달 → PoseCanvas 에 heading 화살표 추가.
  이제 "위치 + 방향 = 자세(pose)" 를 표시. 제자리 회전이 화살표로 보임.

---

## 4. 앞으로 (TODO)

- [ ] `npm run dev` + 데모 모드로 UI 먼저 확인
- [ ] Docker(`docker compose up`)로 rosbridge + fake_robot 실제 연결
- [ ] WSL2 + WSLg 로 Gazebo(TurtleBot3) GUI 시뮬 연결
- [ ] `/scan` 장애물 시각화 위젯
- [x] **(D-010) 카메라 실영상 검증**: Gazebo waffle_pi + aiortc 브리지 → 640x480/ICE completed(2026-07-03)
- [x] (D-010) **브라우저 실영상**: Windows Docker Desktop 에서 Chrome 30fps 640x480 렌더 확인
- [x] (D-010) **Windows Docker WebRTC 미디어 뚫기**: 고정 UDP포트 + 0.0.0.0 바인딩 + 브라우저IP 후보 3수정
- [x] (D-010) **회색 프레임 해결**: Gazebo sun/모델경로 로드로 실제 장면 렌더
- [x] (D-010) **조종/텔레메트리**: rosbridge 서비스 추가로 버튼 조종 + odom/scan 표시
- [ ] 지도 클릭 → Nav2 목적지(**액션**) 전송 — 토픽 아닌 액션 사용 연습
- [ ] 서비스 호출 버튼 추가 — 토픽/서비스 차이 체감용
- [ ] D-001~006 을 내 말로 다시 설명해보고, 이견 있으면 수정/반박 기록

---

## 5. 새 항목 템플릿

```
### D-00N. 제목   (✅ 이해/검증됨 | ⬜ 미검토)
- 대안/접근:
- 결정 근거:
- AI 제안에서 바꾼 것(있으면):
- 검증 방법 / 내 의견:
```
