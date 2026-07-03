# 텔레메트리/제어용 rosbridge (WebSocket :9090). 대시보드의 /odom·/scan 구독, /cmd_vel 발행을 중계.
FROM ros:humble-ros-base

RUN apt-get update && apt-get install -y --no-install-recommends \
      ros-humble-rosbridge-suite \
 && rm -rf /var/lib/apt/lists/*

EXPOSE 9090
CMD ["bash", "-lc", "source /opt/ros/humble/setup.bash && exec ros2 launch rosbridge_server rosbridge_websocket_launch.xml"]
