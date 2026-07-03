# Gazebo(TurtleBot3 waffle_pi) 헤드리스 시뮬 — 카메라/라이다/odom 토픽 발행.
# 카메라 센서는 OGRE(OpenGL) 오프스크린 렌더가 필요 → xvfb(가상 프레임버퍼) + 소프트웨어 GL.
FROM ros:humble-ros-base

RUN apt-get update && apt-get install -y --no-install-recommends \
      ros-humble-turtlebot3-gazebo \
      ros-humble-gazebo-ros-pkgs \
      xvfb \
      libgl1-mesa-dri \
      mesa-utils \
 && rm -rf /var/lib/apt/lists/*

ENV TURTLEBOT3_MODEL=waffle_pi
# 소프트웨어 GL(llvmpipe) + 온라인 모델 DB 차단(오프라인 hang 방지)
ENV LIBGL_ALWAYS_SOFTWARE=1
ENV GAZEBO_MODEL_DATABASE_URI=""

# Xvfb 가상 디스플레이에서 카메라 GL 렌더. xvfb-run 은 PID1 에서 멈추므로(명령 exec 실패)
# Xvfb 를 직접 띄우는 엔트리포인트 사용.
COPY sim-entrypoint.sh /sim-entrypoint.sh
RUN chmod +x /sim-entrypoint.sh
CMD ["/sim-entrypoint.sh"]
