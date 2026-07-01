#!/usr/bin/env bash
# TurtleBot3 Gazebo 시뮬 실행 (WSLg 로 3D 창 표시).
# wsl -d Ubuntu-22.04 -u root bash wsl-run-sim.sh
source /opt/ros/humble/setup.bash
export TURTLEBOT3_MODEL=burger
export DISPLAY=:0                 # WSLg 디스플레이
export LIBGL_ALWAYS_SOFTWARE=1    # WSLg 에서 Gazebo GL 안정화 (느리지만 확실)
export GAZEBO_MODEL_DATABASE_URI=""  # 온라인 모델 DB 접속 차단 (WSL hang 방지)
# turtlebot3_world: 벽/장애물 있는 기본 맵. 가벼운 걸 원하면 empty_world 로.
exec ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py
