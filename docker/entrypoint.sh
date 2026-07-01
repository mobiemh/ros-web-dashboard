#!/usr/bin/env bash
set -e
source /opt/ros/humble/setup.bash

# rosbridge WebSocket 서버 (:9090) 백그라운드 기동
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &

# rosbridge 가 뜰 시간을 잠깐 준 뒤 가짜 로봇 노드 실행
sleep 3
exec python3 /fake_robot.py
