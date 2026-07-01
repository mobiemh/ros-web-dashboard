#!/usr/bin/env bash
# rosbridge WebSocket 서버(:9090) 실행. 대시보드가 여기에 붙는다.
# wsl -d Ubuntu-22.04 -u root bash wsl-run-rosbridge.sh
source /opt/ros/humble/setup.bash
exec ros2 launch rosbridge_server rosbridge_websocket_launch.xml
