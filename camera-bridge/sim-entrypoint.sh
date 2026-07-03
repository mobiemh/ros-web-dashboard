#!/bin/bash
# 헤드리스 Gazebo 엔트리포인트.
# xvfb-run 을 PID1 로 쓰면 Xvfb 만 뜨고 명령을 exec 하지 못해 멈춘다(프로세스 트리로 확인).
# → Xvfb 를 직접 백그라운드로 띄우고 DISPLAY 설정 후 launch 를 exec 하는 정석 패턴.
set -e
export DISPLAY=:99
rm -f /tmp/.X99-lock
Xvfb :99 -screen 0 1280x720x24 -nolisten tcp &
# Xvfb 준비 대기 (lock 파일 생성 = 준비 완료)
for i in $(seq 1 30); do
  if [ -f /tmp/.X99-lock ]; then break; fi
  sleep 0.3
done
sleep 1
source /opt/ros/humble/setup.bash
# gazebo 기본 모델 경로(sun/ground_plane 등)를 잡아준다. 안 그러면 GAZEBO_MODEL_PATH 가 비어
# model://sun(광원)·ground_plane 이 로드 안 돼 카메라가 빛 없는 빈 장면(회색)만 렌더한다.
[ -f /usr/share/gazebo/setup.sh ] && source /usr/share/gazebo/setup.sh
export GAZEBO_MODEL_DATABASE_URI=""   # 온라인 DB 는 계속 차단(무접속 hang 방지) — 모델은 로컬 사용
export GAZEBO_MODEL_PATH="/usr/share/gazebo-11/models:${GAZEBO_MODEL_PATH}"
exec ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py
