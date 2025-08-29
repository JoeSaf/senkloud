#!/usr/bin/env bash
# setup-hotspot.sh — interactive one-time setup for an offline Wi-Fi AP (infrastructure mode)
# NixOS-ready, prefers USB Wi-Fi adapter supporting AP mode

set -euo pipefail

need_root() {
  [[ $EUID -eq 0 ]] || { echo "Please run as root: sudo $0"; exit 1; }
}

install_packages_nixos() {
  echo "[*] Installing required packages via nix-env..."
  for pkg in hostapd dnsmasq iw iproute2 iptables ; do
    if ! command -v "$pkg" >/dev/null 2>&1; then
      nix-env -iA "nixos.$pkg"
    fi
  done
}

pick_ap_iface() {
    local ifaces iface phyname ap_iface

    # Get all Wi-Fi interfaces
    ifaces=$(iw dev | awk '/Interface/ {print $2}')
    [[ -n "$ifaces" ]] || { echo "No Wi-Fi interfaces found"; exit 1; }

    for iface in $ifaces; do
        phyname=$(iw dev "$iface" info | awk '/wiphy/ {print $2}')
        if iw phy phy"$phyname" info | grep -q 'AP'; then
            # Prefer USB first
            if udevadm info /sys/class/net/$iface 2>/dev/null | grep -q "ID_BUS=usb"; then
                ap_iface="$iface"
                break
            elif [[ -z "$ap_iface" ]]; then
                ap_iface="$iface"  # fallback to first AP-capable interface
            fi
        fi
    done

    [[ -n "$ap_iface" ]] || { echo "No AP-capable Wi-Fi interfaces found"; exit 1; }
    echo "$ap_iface"
}

prompt_value() {
  local prompt="$1" default="$2" val
  read -rp "$prompt [$default]: " val
  echo "${val:-$default}"
}

prompt_secret() {
  local prompt="$1" pass1 pass2
  while true; do
    read -rsp "$prompt (8–63 chars): " pass1; echo
    read -rsp "Confirm password: " pass2; echo
    [[ "$pass1" != "$pass2" ]] && { echo "Passwords do not match. Try again."; continue; }
    [[ ${#pass1} -lt 8 || ${#pass1} -gt 63 ]] && { echo "Password length invalid. Try again."; continue; }
    echo -n "$pass1"
    return
  done
}

write_env() {
  mkdir -p /etc/offline-ap
  cat > /etc/offline-ap/ap.env <<EOF
WIFI_IFACE="$WIFI_IFACE"
SSID="$SSID"
PASSPHRASE="$PASSPHRASE"
CHANNEL="$CHANNEL"
COUNTRY_CODE="$COUNTRY_CODE"

AP_IP="10.42.0.1"
AP_CIDR="10.42.0.1/24"
DHCP_RANGE_START="10.42.0.10"
DHCP_RANGE_END="10.42.0.200"
DHCP_LEASE="12h"

NAT_ENABLED="0"
UPSTREAM_IFACE=""
EOF

  chmod 600 /etc/offline-ap/ap.env
}

write_hostapd() {
  mkdir -p /etc/hostapd
  cat > /etc/hostapd/offline-ap.conf <<EOF
interface=$WIFI_IFACE
ssid=$SSID
country_code=$COUNTRY_CODE
hw_mode=g
channel=$CHANNEL
ieee80211n=1
wmm_enabled=1

auth_algs=1
wpa=2
wpa_passphrase=$PASSPHRASE
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
EOF
}

write_dnsmasq() {
  mkdir -p /var/lib/misc /etc/dnsmasq.d
  cat > /etc/dnsmasq.d/offline-ap.conf <<EOF
interface=$WIFI_IFACE
bind-interfaces
dhcp-authoritative

dhcp-range=10.42.0.10,10.42.0.200,12h
dhcp-option=option:router,10.42.0.1
dhcp-option=option:dns-server,10.42.0.1

dhcp-leasefile=/var/lib/misc/dnsmasq.offline-ap.leases
EOF
}

main() {
  need_root
  mkdir -p /etc/offline-ap /etc/hostapd /etc/dnsmasq.d /var/run/offline-ap

  install_packages_nixos

  echo
  echo "=== Offline Hotspot Setup (Infrastructure mode) ==="
  WIFI_IFACE=$(pick_ap_iface)
  SSID=$(prompt_value "Network name (SSID)" "OfflineNet")
  COUNTRY_CODE=$(prompt_value "Country code (regulatory)" "TZ")
  CHANNEL=$(prompt_value "Wi-Fi channel (1–11 for 2.4GHz)" "6")
  PASSPHRASE=$(prompt_secret "Create WPA2 password")

  write_env
  source /etc/offline-ap/ap.env
  write_hostapd
  write_dnsmasq

  echo
  echo "✅ Setup done."
  echo "Files created:"
  echo "  • /etc/offline-ap/ap.env"
  echo "  • /etc/hostapd/offline-ap.conf"
  echo "  • /etc/dnsmasq.d/offline-ap.conf"
  echo
  echo "Next steps:"
  echo "  1) Make the manager executable:  chmod +x hotspot-manager.sh"
  echo "  2) Launch it:                   sudo ./hotspot-manager.sh"
  echo
}

main "$@"
