# Local Development Workflow

## Prerequisites
- [Docker](https://www.docker.com/)

## Installation
- Clone this repository
- Build the docker container: `docker compose build`. This can take a while, but is only required on first setup, and on any future changes on the *Dockerfile*.
- Edit permission for the scripts:  
    - `chmod +x ./scripts/start.sh`  
    - `chmod +x ./scripts/docker-exec-app.sh`  
    - `chmod +x ./scripts/docker-logs-app.sh`  
    - `chmod +x ./scripts/watch.sh`  
- Start the application by running `./scripts/start.sh`.
- Local express server will be available at `http://localhost:3333`.
- To allow scripts server to restart on file changes, run `./scripts/watch.sh`.