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
};
