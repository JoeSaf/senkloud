# 🧠 Personal Cloud Media Server (Flask + Jellyfin)

This project contains a portable, self-hosted media server stack using:

- 🎞️ [Jellyfin](https://jellyfin.org) for streaming movies/music/photos
- 🖼️ A custom Flask app for uploading, browsing, and streaming your own media files
- 📦 Docker for containerized deployment
- 🧳 Optional portability via `.tar` images for offline installation

---

## 📁 Directory Structure

```plaintext
project/
│
├── Dockerfile                  # Flask app Dockerfile
├── docker-compose.yml          # Defines Jellyfin + Flask services
├── requirements.txt            # Flask dependencies
├── app.py                      # Flask server script
├── templates/                  # Flask HTML templates
├── static/                     # Flask static assets (thumbnails, CSS)
│
├── flask-media-manager.tar     # (optional) Pre-built Flask image (use `docker save`)
├── jellyfin.tar                # (optional) Pre-built Jellyfin image (use `docker save`)
```

---

## 🛠️ Setup Instructions

### 1. 🔨 Build the Docker Images (First-Time Only)

```bash
docker compose build
```

Optional: Save images to portable `.tar` files:

```bash
docker save -o flask-media-manager.tar flask-media-manager
docker save -o jellyfin.tar jellyfin/jellyfin:latest
```

---

### 2. 🧳 Portable Deployment on a New Machine

On the new machine:

```bash
docker load -i flask-media-manager.tar
docker load -i jellyfin.tar
```

Then:

```bash
docker compose up -d
```

✔️ You're ready to go.

---

## 📦 Media Volume Layout

Your host media directory should be:

```
/mnt/media/
├── uploads/     # Flask uploads here
├── movies/      # Jellyfin scans here
├── photos/      # Shared
```

Make sure this exists before running the container:

```bash
mkdir -p /mnt/media/uploads /mnt/media/movies /mnt/media/photos
```

---

## 🌐 Services

| Service      | Port | Description                       |
|--------------|------|-----------------------------------|
| Flask App    | 5000 | Upload, browse, stream media      |
| Jellyfin     | 8096 | Full media library + streaming    |

---

## 🔐 Authentication

- Flask app: login required (session-based)
- Jellyfin: setup credentials on first run via browser

---

## 🧩 Optional Features (Flask App)

- Dark mode toggle
- Video thumbnail previews (via ffmpeg)
- Admin panel (file deletion)
- Secure filename handling
- Range support for streaming
- Mobile-friendly UI (Bootstrap/Tailwind)

---

## 🚨 Tips

- Be sure to set `FLASK_ENV=production` in `docker-compose.yml`
- You can edit environment variables and re-run `docker compose up -d`
- Persistent storage is preserved across redeployments using named Docker volumes:
  - `jellyfin_config`
  - `jellyfin_cache`
  - `flask_data`
  - `flask_thumbnails`

---

## 💬 Support

If you’re migrating this to another machine and something breaks, make sure:

- Volumes mount correctly
- Ports are available (5000, 8096)
- You have permissions on `/mnt/media`

---

## 🧠 What This Is

This is your **private cloud**. You can:

- Upload media from any device on your LAN
- Stream it to your phone, TV, or laptop
- Host it anywhere, even offline

---
