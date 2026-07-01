#!/usr/bin/env bash
# WSL2(Ubuntu 22.04)에 ROS 2 Humble + Gazebo + TurtleBot3 + rosbridge 설치.
# root 로 실행 (wsl -d Ubuntu-22.04 -u root bash wsl-setup-ros.sh)
set -e

# apt 가 중간에 대화형 프롬프트로 멈추지 않게
export DEBIAN_FRONTEND=noninteractive
export TZ=Asia/Seoul

echo "[1/5] 로케일 설정"
apt-get update
apt-get install -y locales curl gnupg lsb-release software-properties-common
locale-gen en_US en_US.UTF-8
update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8

echo "[2/5] ROS 2 apt 저장소 추가"
add-apt-repository universe -y
curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key \
  -o /usr/share/keyrings/ros-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] \
http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" \
  > /etc/apt/sources.list.d/ros2.list

echo "[3/5] 패키지 목록 갱신"
apt-get update

echo "[4/5] ROS 2 + Gazebo + TurtleBot3 + rosbridge 설치 (수 분 소요)"
apt-get install -y \
  ros-humble-ros-base \
  ros-humble-turtlebot3 \
  ros-humble-turtlebot3-gazebo \
  ros-humble-gazebo-ros-pkgs \
  ros-humble-rosbridge-suite

echo "[5/5] 환경 설정 (.bashrc)"
BASHRC=/root/.bashrc
grep -q "source /opt/ros/humble/setup.bash" "$BASHRC" || {
  echo "source /opt/ros/humble/setup.bash" >> "$BASHRC"
  echo "export TURTLEBOT3_MODEL=burger" >> "$BASHRC"
}

echo "설치 완료. 확인:"
source /opt/ros/humble/setup.bash
ros2 --version || true
echo "DONE"
