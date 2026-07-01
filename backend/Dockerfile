FROM ros:humble-ros-base

RUN apt-get update \
 && apt-get install -y python3-pip \
 && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir fastapi "uvicorn[standard]"

WORKDIR /app
COPY main.py fake_robot.py entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 8000
CMD ["./entrypoint.sh"]
