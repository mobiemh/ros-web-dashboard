#!/usr/bin/env bash
set -e
source /opt/ros/humble/setup.bash

# 로봇 시뮬 노드 백그라운드 실행
python3 fake_robot.py &

# ROS 노드가 뜰 시간을 잠깐 준 뒤 백엔드(API+WS) 실행
sleep 2
exec uvicorn main:app --host 0.0.0.0 --port 8000
