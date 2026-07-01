FROM ros:humble-ros-base

# rosbridge (WebSocket 서버) 설치
RUN apt-get update \
 && apt-get install -y ros-humble-rosbridge-suite \
 && rm -rf /var/lib/apt/lists/*

COPY fake_robot.py /fake_robot.py
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 9090
CMD ["/entrypoint.sh"]
