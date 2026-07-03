# ROS 카메라 → WebRTC 브리지 (aiortc). Gazebo(Humble)와 같은 Humble 로 맞춰 DDS 연결을 깨끗하게.
FROM ros:humble-ros-base

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3-pip \
      ros-humble-sensor-msgs \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir -r /tmp/requirements.txt

COPY bridge.py /bridge.py

ENV CAMERA_TOPIC=/camera/image_raw
ENV BRIDGE_PORT=8080
EXPOSE 8080

# ROS 환경 source 후 브리지 실행
CMD ["bash", "-lc", "source /opt/ros/humble/setup.bash && exec python3 /bridge.py"]
