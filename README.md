# Local Development Workflow

## Prerequisites
- [Docker](https://www.docker.com/)

## Installation
- Clone this repository
- Copy `.env.sample` to `.env`. Update recommended variables accordingly.
- Build the docker container: `docker compose build`. This can take a while, but is only required on first setup, and on any future changes on the *Dockerfile*.
- Start the application by running `docker compose up -d`.