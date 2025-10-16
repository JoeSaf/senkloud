
# Senkloud External Storage Setup — NixOS

This document explains how to integrate external drives into your Senkloud setup on NixOS, providing additional storage for media and uploads.

---

## Overview

Senkloud is designed to work with both internal and external storage. The external drives are:

* Formatted as **Btrfs** for performance and compression.
* Mounted automatically using **label-based mounting**.
* Bind-mounted into `/mnt/media` so that Jellyfin, Flask apps, and Senkloud continue to access media transparently.
* Writable by all relevant users and services.

Directory structure:

```
/mnt/media2/        # Main external storage root
/mnt/media2/movies  # Movies external drive
/mnt/media2/photos  # Photos external drive
/mnt/media2/uploads # Uploads external drive
/mnt/media           # Bind mount to media2 for Senkloud apps
```

---

## Step 1: Prepare the External Drives

1. Connect the external drive.
2. Format it as **Btrfs** and assign a unique label according to the media type:

```bash
sudo mkfs.btrfs -L senkloud_movies /dev/sdX1
sudo mkfs.btrfs -L senkloud_photos /dev/sdY1
sudo mkfs.btrfs -L senkloud_uploads /dev/sdZ1
```

Replace `/dev/sdX1` etc. with the actual device path of your drives.

---

## Step 2: Create Mount Points

Create directories for each drive under `/mnt/media2`:

```bash
sudo mkdir -p /mnt/media2/movies
sudo mkdir -p /mnt/media2/photos
sudo mkdir -p /mnt/media2/uploads
```

Set permissions so Senkloud apps can read and write:

```bash
sudo chown -R senjoe:1000 /mnt/media2
sudo chmod -R 777 /mnt/media2
```

---

## Step 3: Configure NixOS

Add the following to your `/etc/nixos/configuration.nix` under `fileSystems`:

```nix
fileSystems."/mnt/media2/movies" = {
  device = "/dev/disk/by-label/senkloud_movies";
  fsType = "btrfs";
  options = [ "rw" "noatime" "compress=zstd" ];
};

fileSystems."/mnt/media2/photos" = {
  device = "/dev/disk/by-label/senkloud_photos";
  fsType = "btrfs";
  options = [ "rw" "noatime" "compress=zstd" ];
};

fileSystems."/mnt/media2/uploads" = {
  device = "/dev/disk/by-label/senkloud_uploads";
  fsType = "btrfs";
  options = [ "rw" "noatime" "compress=zstd" ];
};

fileSystems."/mnt/media" = {
  device = "/mnt/media2";
  options = [ "bind" ];
};
```

> Note: `fileSystems."/mnt/media"` is a bind mount pointing to `/mnt/media2` for Senkloud compatibility.

---

## Step 4: Rebuild NixOS

After editing your configuration:

```bash
sudo nixos-rebuild switch
```

All external drives will now mount automatically at boot if plugged in.

---

## Step 5: Verify Mounts

```bash
mount | grep media
```

Expected output:

```
/dev/sdX1 on /mnt/media2/movies type btrfs (rw,noatime,compress=zstd)
/dev/sdY1 on /mnt/media2/photos type btrfs (rw,noatime,compress=zstd)
/dev/sdZ1 on /mnt/media2/uploads type btrfs (rw,noatime,compress=zstd)
/mnt/media2 on /mnt/media type none (rw,bind)
```

---
## Troubleshooting

* **System fails to boot due to `local-fs.target`**: Likely caused by missing external drives.

  * Use `noauto` and `x-systemd.device-timeout=10s` in `configuration.nix` to fix.
* **Permissions issues on media directories**: Ensure `/mnt/media2` and subdirectories are owned by the app user (`senjoe`) and writable (`chmod -R 777 /mnt/media2`).
* **Docker build errors**: Ensure you’re in the **repo root** where `docker-compose.yml` is located.

---


## Notes

* Each external drive must have a **unique label**.
* Permissions are set to allow **read/write access for Senkloud apps**.
* New drives can be added by formatting and labeling them, then creating the corresponding mount point and updating `configuration.nix`.
* For multiple externals, this approach keeps media separated (movies, photos, uploads) while still exposing a single path `/mnt/media` to Senkloud.

---

This is a clean, scalable approach for adding external storage to Senkloud on NixOS, ensuring automatic mounting, proper permissions, and seamless integration with your apps.

---

