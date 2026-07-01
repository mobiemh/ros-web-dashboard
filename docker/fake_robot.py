#!/usr/bin/env python3
"""
GUI/실물 로봇 없이 대시보드를 테스트하기 위한 최소 ROS 2 노드.
- /odom (nav_msgs/Odometry) 를 10Hz 로 발행 (기본은 원운동)
- /cmd_vel (geometry_msgs/Twist) 를 구독해 대시보드 Teleop 조작을 반영

실제 로봇/시뮬(TurtleBot3 등)로 바꾸면 이 노드만 빼면 됩니다.
"""
import math
import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry
from geometry_msgs.msg import Twist


class FakeRobot(Node):
    def __init__(self):
        super().__init__('fake_robot')
        self.pub = self.create_publisher(Odometry, '/odom', 10)
        self.create_subscription(Twist, '/cmd_vel', self.on_cmd, 10)

        self.x = 0.0
        self.y = 0.0
        self.theta = 0.0
        self.lin = 0.2   # 기본 전진 속도
        self.ang = 0.5   # 기본 회전 속도 (→ 원운동)
        self.dt = 0.1
        self.create_timer(self.dt, self.tick)
        self.get_logger().info('fake_robot up: publishing /odom, listening /cmd_vel')

    def on_cmd(self, msg: Twist):
        # 대시보드 Teleop 이 보낸 명령으로 움직임 갱신
        self.lin = msg.linear.x
        self.ang = msg.angular.z

    def tick(self):
        self.theta += self.ang * self.dt
        self.x += self.lin * math.cos(self.theta) * self.dt
        self.y += self.lin * math.sin(self.theta) * self.dt

        odom = Odometry()
        odom.header.stamp = self.get_clock().now().to_msg()
        odom.header.frame_id = 'odom'
        odom.child_frame_id = 'base_link'
        odom.pose.pose.position.x = self.x
        odom.pose.pose.position.y = self.y
        odom.pose.pose.orientation.z = math.sin(self.theta / 2.0)
        odom.pose.pose.orientation.w = math.cos(self.theta / 2.0)
        odom.twist.twist.linear.x = self.lin
        odom.twist.twist.angular.z = self.ang
        self.pub.publish(odom)


def main():
    rclpy.init()
    node = FakeRobot()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
