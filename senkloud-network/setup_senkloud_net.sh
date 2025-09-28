#!/usr/bin/env bash
# setup-hotspot.sh — interactive one-time setup for an offline Wi-Fi AP (infrastructure mode)

set -euo pipefail

need_root() {
  if [[ $EUID -ne 0 ]]; then
    echo "Please run as root: sudo $0"
    exit 1
  fi
}

detect_pkg_mgr() {
  if command -v apt-get >/dev/null 2>&1; then echo "apt"; return; fi
  if command -v dnf >/dev/null 2>&1;     then echo "dnf"; return; fi
  if command -v yum >/dev/null 2>&1;     then echo "yum"; return; fi
  if command -v pacman >/dev/null 2>&1;  then echo "pacman"; return; fi
  if command -v zypper >/dev/null 2>&1;  then echo "zypper"; return; fi
  echo "unknown"
}

install_packages() {
  local mgr="$1"
  echo "[*] Installing required packages: hostapd dnsmasq iw iproute2 iptables/libnewt/whiptail"

  case "$mgr" in
    apt)
      apt-get update
      DEBIAN_FRONTEND=noninteractive apt-get install -y hostapd dnsmasq iw iproute2 iptables whiptail
      ;;
    dnf)    dnf install -y hostapd dnsmasq iw iproute iptables whiptail ;;
    yum)    yum install -y hostapd dnsmasq iw iproute iptables newt || true; command -v whiptail >/dev/null || yum install -y whiptail ;;
    pacman)
      # On Arch/Garuda: iptables conflicts with iptables-nft. Use iptables-nft if present.
      pacman -Sy --needed hostapd dnsmasq iw iproute2 libnewt
      ;;
    zypper) zypper --non-interactive install hostapd dnsmasq iw iproute2 iptables whiptail ;;
    *)
      echo "!! Unknown package manager. Please install manually: hostapd dnsmasq iw iproute2 iptables whiptail"
      ;;
  esac
}

pick_wifi_iface() {
  local ifaces
  if ! command -v iw >/dev/null 2>&1; then
    echo "!! 'iw' not found — cannot detect Wi-Fi interface."; exit 1
  fi
  ifaces=$(iw dev | awk '/Interface/ {print $2}')
  if [[ -z "$ifaces" ]]; then
    echo "!! No Wi-Fi interfaces found (iw dev returned none)."; exit 1
  fi
  # Prefer the first interface that supports AP mode
  local first_ap=""
  for i in $ifaces; do
    if iw phy "$(iw dev "$i" info | awk '/wiphy/ {print $2}')" info 2>/dev/null | grep -q "\* AP\b"; then
      first_ap="$i"; break
    fi
  done
  if [[ -z "$first_ap" ]]; then
    # fallback to first seen interface
    first_ap=$(echo "$ifaces" | head -n1)
  fi

  read -rp "Wi-Fi interface to use [$first_ap]: " chosen
  echo "${chosen:-$first_ap}"
}

prompt_value() {
  local prompt="$1" default="$2"
  read -rp "$prompt [$default]: " val
  echo "${val:-$default}"
}

prompt_secret() {
  local prompt="$1" var pass1 pass2
  while true; do
    read -rsp "$prompt (8–63 chars): " pass1; echo
    read -rsp "Confirm password: " pass2; echo
    if [[ "$pass1" != "$pass2" ]]; then
      echo "Passwords do not match. Try again."
      continue
    fi
    if [[ ${#pass1} -lt 8 || ${#pass1} -gt 63 ]]; then
      echo "Password length invalid. Try again."
      continue
    fi
    echo -n "$pass1"  # Use -n to avoid trailing newline
    return
  done
}

write_env() {
  # Ensure directory exists
  mkdir -p /etc/offline-ap
  
  # Use printf instead of cat to avoid any newline issues
  printf '# Offline AP settings\n'
  printf 'WIFI_IFACE="%s"\n' "$WIFI_IFACE"
  printf 'SSID="%s"\n' "$SSID"
  printf 'PASSPHRASE="%s"\n' "$PASSPHRASE"
  printf 'CHANNEL="%s"\n' "$CHANNEL"
  printf 'COUNTRY_CODE="%s"\n' "$COUNTRY_CODE"
  printf '\n'
  printf 'AP_IP="10.42.0.1"\n'
  printf 'AP_CIDR="10.42.0.1/24"\n'
  printf 'DHCP_RANGE_START="10.42.0.10"\n'
  printf 'DHCP_RANGE_END="10.42.0.200"\n'
  printf 'DHCP_LEASE="12h"\n'
  printf '\n'
  printf '# NAT (internet sharing) — off by default; manageable via TUI\n'
  printf 'NAT_ENABLED="0"\n'
  printf 'UPSTREAM_IFACE=""\n' > /etc/offline-ap/ap.env
  
  chmod 600 /etc/offline-ap/ap.env
}

write_hostapd() {
  # Ensure directory exists
  mkdir -p /etc/hostapd
  
  # Use printf to avoid newline issues
  printf 'interface=%s\n' "$WIFI_IFACE"
  printf 'ssid=%s\n' "$SSID"
  printf 'country_code=%s\n' "$COUNTRY_CODE"
  printf 'hw_mode=g\n'
  printf 'channel=%s\n' "$CHANNEL"
  printf 'ieee80211n=1\n'
  printf 'wmm_enabled=1\n'
  printf '\n'
  printf 'auth_algs=1\n'
  printf 'wpa=2\n'
  printf 'wpa_passphrase=%s\n' "$PASSPHRASE"
  printf 'wpa_key_mgmt=WPA-PSK\n'
  printf 'rsn_pairwise=CCMP\n' > /etc/hostapd/offline-ap.conf
}

write_dnsmasq() {
  mkdir -p /var/lib/misc
  mkdir -p /etc/dnsmasq.d
  
  cat > /etc/dnsmasq.d/offline-ap.conf <<EOF
# Bind only to our AP interface
interface=$WIFI_IFACE
bind-interfaces
dhcp-authoritative

# Addressing
dhcp-range=$DHCP_RANGE_START,$DHCP_RANGE_END,$DHCP_LEASE
dhcp-option=option:router,$AP_IP
dhcp-option=option:dns-server,$AP_IP

# Leases file (separate from system default)
dhcp-leasefile=/var/lib/misc/dnsmasq.offline-ap.leases
EOF
}

main() {
  need_root

  mkdir -p /etc/offline-ap
  mkdir -p /etc/hostapd
  mkdir -p /etc/dnsmasq.d
  mkdir -p /var/log
  mkdir -p /var/run/offline-ap

  PKG_MGR=$(detect_pkg_mgr)
  install_packages "$PKG_Mgr"

  echo
  echo "=== Offline Hotspot Setup (Infrastructure mode) ==="
  WIFI_IFACE=$(pick_wifi_iface)
  SSID=$(prompt_value "Network name (SSID)" "OfflineNet")
  # Default country code for you (TZ). Change if needed.
  COUNTRY_CODE=$(prompt_value "Country code (regulatory)" "TZ")
  CHANNEL=$(prompt_value "Wi-Fi channel (1–11 for 2.4GHz)" "6")
  PASSPHRASE=$(prompt_secret "Create WPA2 password")

  # Persist and config
  AP_IP="10.42.0.1"
  DHCP_RANGE_START="10.42.0.10"
  DHCP_RANGE_END="10.42.0.200"
  DHCP_LEASE="12h"

  write_env
  # shellcheck disable=SC1091
  source /etc/offline-ap/ap.env
  write_hostapd
  write_dnsmasq

  # Don't auto-enable system services; we manage them ourselves.
  if command -v systemctl >/dev/null 2>&1; then
    systemctl disable --now hostapd 2>/dev/null || true
    systemctl disable --now dnsmasq 2>/dev/null || true
  fi

  echo
  echo "✅ Setup done."
  echo "Files:"
  echo "  • /etc/offline-ap/ap.env"
  echo "  • /etc/hostapd/offline-ap.conf"
  echo "  • /etc/dnsmasq.d/offline-ap.conf"
  echo
  echo "Next steps:"
  echo "  1) Make the manager executable:  chmod +x senkloud_network_tui.sh"
  echo "  2) Launch it:                   sudo ./senkloud_network_tui.sh"
  echo
}

main "$@"
