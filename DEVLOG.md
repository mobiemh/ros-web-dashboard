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

> 참고: D-001~D-009 은 AI 가 스캐폴딩·설명하며 제안한 것을, 대화(개념 설명 + 트레이드오프
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
