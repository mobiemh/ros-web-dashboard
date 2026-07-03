// 구독/발행할 토픽 정의. 여기만 바꾸면 대시보드 전체가 따라갑니다.
//
// messageType 표기:
//   - ROS 2 (rosbridge): 'nav_msgs/msg/Odometry'   (아래 기본값)
//   - ROS 1 (rosbridge): 'nav_msgs/Odometry'        (/msg/ 없이)
// 지원하는 로봇/공고 스택에 맞춰 조정하세요.

export const TOPICS = {
  odom: { name: '/odom', type: 'nav_msgs/msg/Odometry' },
  cmdVel: { name: '/cmd_vel', type: 'geometry_msgs/msg/Twist' },
  scan: { name: '/scan', type: 'sensor_msgs/msg/LaserScan' },
  // 카메라 영상은 다른 토픽과 달리 rosbridge 로 나르지 않는다.
  // sensor_msgs/Image 를 JSON 으로 흘리면 대역폭·지연이 커서 실시간에 부적합 →
  // webrtc_ros 서버가 이 토픽을 WebRTC 로 브라우저에 직접 스트리밍한다 (webrtcRos.js).
  camera: { name: '/camera/image_raw', type: 'sensor_msgs/msg/Image' },
};
