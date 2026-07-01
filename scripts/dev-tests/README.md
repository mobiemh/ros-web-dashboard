# dev-tests — 계층 격리 검증 스크립트

프론트(브라우저) 없이 **각 계층을 따로 떼어 테스트**해 문제 범위를 좁히는 스크립트.
Node 18+ 의 내장 `WebSocket` 사용 (별도 의존성 없음).

| 스크립트 | 검증 대상 | 경로 |
|----------|-----------|------|
| `test-rosbridge-odom.mjs` | rosbridge 가 /odom 을 WS 로 내보내나 | 브라우저↔**rosbridge:9090**↔ROS |
| `test-backend-cmd.mjs` | 백엔드 명령 경로가 로봇에 반영되나 | 브라우저↔**백엔드:8000**↔ROS |

## 왜 있나 (DEVLOG T-001, T-003 참조)
"버튼 무반응" 같은 문제가 났을 때, 전체(프론트+WS+백엔드+ROS+로봇)를 헤매지 않고
**한 계층만 떼어 정상/이상을 가려** 범위를 좁히기 위함. 예: 이 스크립트로 백엔드가
정상임을 확인 → 문제는 프론트에 있다고 결론.

## 사용
```bash
# rosbridge + Gazebo 가 떠 있을 때
node scripts/dev-tests/test-rosbridge-odom.mjs

# platform 백엔드가 떠 있을 때 (정지 / 원운동)
node scripts/dev-tests/test-backend-cmd.mjs 0 0
node scripts/dev-tests/test-backend-cmd.mjs 0.2 0.5
```
