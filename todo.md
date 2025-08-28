

my file structure{
    drwxr-xr-x    - senjoe 26 Ago 13:42  senkloud-backend
drwxr-xr-x    - senjoe 26 Ago 13:41  senkloud-frontend
}

my docker compose
{
    version: '3.8'

services:
  jellyfin:
    image: jellyfin/jellyfin:latest
    container_name: jellyfin
    restart: always
    ports:
      - "8096:8096"
    volumes:
      - jellyfin_config:/config
      - jellyfin_cache:/cache
      - /mnt/media:/media:ro
    environment:
      - JELLYFIN_PublishedServerUrl=http://localhost:8096
    networks:
      - media_network

  flask-media-manager:
    build: 
      context: .
      dockerfile: Dockerfile
    container_name: flask-media-manager
    restart: always
    ports:
      - "5000:5000"
    volumes:
      - /mnt/media:/mnt/media
      - flask_data:/app/data
      - flask_thumbnails:/app/static/thumbnails
    environment:
      - SECRET_KEY=local-media-server-secret-key-2024
      - JELLYFIN_URL=http://jellyfin:8096
      - FLASK_ENV=production
      - PYTHONUNBUFFERED=1
    depends_on:
      - jellyfin
    networks:
      - media_network
    command: >
      bash -c "
        mkdir -p /mnt/media/Pictures /mnt/media/Movies /mnt/media/Music &&
        chown -R 1000:1000 /mnt/media &&
        python app.py
      "

volumes:
  jellyfin_config:
    driver: local
  jellyfin_cache:
    driver: local
  flask_data:
    driver: local
  flask_thumbnails:
    driver: local

networks:
  media_network:
    driver: bridge

}

my frontend runs on npm run dev
my backend runs on python app.py

i also wanna 
{
        install cockpit
    install tailscale vpn
}