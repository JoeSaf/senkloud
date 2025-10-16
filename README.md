
# Senkloud — Private Media Cloud

Senkloud is a personal cloud server for media and documents, built with NixOS, Docker, and custom web apps. It supports media streaming, document reading, and external storage integration.

---

## Table of Contents

* [Features](#features)
* [Prerequisites](#prerequisites)
* [Development Setup](#development-setup)
* [Running in Development](#running-in-development)
* [Deployment](#deployment)
* [External Storage Setup](/AddingStorage.md)
* [Basic Help](/BasicHelp)

---

## Features

* Media streaming (movies, photos, uploads)
* Document reading section (`documents = reading`)
* Web persistent storage to track playback history
* Automatic integration of external drives for media expansion
* Dockerized deployment for easy setup
* NixOS configuration for reproducible environments

---

## Prerequisites

* NixOS minimal (or another Linux distribution with Docker support)
* Node.js and npm (for local development)
* Docker & docker-compose (for production deployment)
* External drives (optional) for expanded media storage

---

## Development Setup

1. Clone the repo:

```bash
git clone https://github.com/JoeSaf/senkloud
cd senkloud
```

2. Install dependencies:

```bash
npm i
```

3. Set up environment variables if needed (e.g., `.env` file for dev server).

---

## Running in Development

Start the development server:

```bash
npm run dev
```

## senkloud-backend
- setup a python virtual environment
```python
python -m venv senkloud-backend
```

- remember to setup the whole backend dir into a virtual environment

- install the dependencies
```
pip install -r requirements.txt
```

- start the server
```
python app.py
```

* This runs the app in development mode with live reload.
* **Note:** This mode is for development only. Use Docker for production deployment.

---

## Deployment with Docker

1. Build and start the full stack:

```bash
cd <repo-root>
docker-compose up -d --build
```

* This will build all services, including Senkloud apps and any configured media services.
* All configurations and volumes are defined in the `docker-compose.yml` at the repo root.

2. Stop services:

```bash
docker-compose down
```

---



## Notes

* Development mode (`npm run dev`) is **not production-ready**. Always deploy via Docker for stability.
* External drives must have **unique labels** to avoid mount conflicts.
* All external media is bound to `/mnt/media` for seamless app integration.

---

