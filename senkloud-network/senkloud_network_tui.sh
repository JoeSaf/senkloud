#!/usr/bin/env bash
# hotspot-manager.sh — TUI to manage your offline Wi-Fi AP

set -euo pipefail

ENV_FILE="/etc/offline-ap/ap.env"
HOSTAPD_CFG="/etc/hostapd/offline-ap.conf"
DNSMASQ_CFG="/etc/dnsmasq.d/offline-ap.conf"
RUN_DIR="/var/run/offline-ap"
LOG_HOSTAPD="/var/log/offline-ap-hostapd.log"
LOG_DNSMASQ="/var/log/offline-ap-dnsmasq.log"
LEASES="/var/lib/misc/dnsmasq.offline-ap.leases"
IPTABLES_TAG="OFFLINE_AP_RULES"

need_root() {
  if [[ $EUID -ne 0 ]]; then
    echo "Please run as root: sudo $0"
    exit 1
  fi
}

require_files() {
  for f in "$ENV_FILE" "$HOSTAPD_CFG" "$DNSMASQ_CFG"; do
    [[ -f "$f" ]] || { echo "Missing $f — run setup-hotspot.sh first."; exit 1; }
  done
}

load_env() {
  # shellcheck disable=SC1090
  source "$ENV_FILE"
}

save_env() {
  cat > "$ENV_FILE" <<EOF
WIFI_IFACE="$WIFI_IFACE"
SSID="$SSID"
PASSPHRASE="$PASSPHRASE"
CHANNEL="$CHANNEL"
COUNTRY_CODE="$COUNTRY_CODE"

AP_IP="$AP_IP"
AP_CIDR="$AP_CIDR"
DHCP_RANGE_START="$DHCP_RANGE_START"
DHCP_RANGE_END="$DHCP_RANGE_END"
DHCP_LEASE="$DHCP_LEASE"

NAT_ENABLED="${NAT_ENABLED:-0}"
UPSTREAM_IFACE="${UPSTREAM_IFACE:-}"
EOF
  chmod 600 "$ENV_FILE"
}

nm_manage() {
  # $1 = yes|no
  if command -v nmcli >/dev/null 2>&1; then
    nmcli dev set "$WIFI_IFACE" managed "$1" || true
  fi
}

kill_if_running() {
  local pidfile="$1"
  if [[ -f "$pidfile" ]]; then
    local pid
    pid=$(cat "$pidfile" 2>/dev/null || echo "")
    if [[ -n "${pid}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" || true
      sleep 0.5
    fi
    rm -f "$pidfile"
  fi
}

apply_ip_setup() {
  ip link set "$WIFI_IFACE" down || true
  ip addr flush dev "$WIFI_IFACE" || true
  ip addr add "$AP_CIDR" dev "$WIFI_IFACE"
  ip link set "$WIFI_IFACE" up
}

start_dnsmasq() {
  mkdir -p "$RUN_DIR"
  # log to file, keep foreground but background via & to capture PID easily
  dnsmasq --conf-file="$DNSMASQ_CFG" --keep-in-foreground --log-facility="$LOG_DNSMASQ" \
    & echo $! > "$RUN_DIR/dnsmasq.pid"
}

start_hostapd() {
  hostapd -B -P "$RUN_DIR/hostapd.pid" -f "$LOG_HOSTAPD" "$HOSTAPD_CFG"
}

stop_dnsmasq() { kill_if_running "$RUN_DIR/dnsmasq.pid"; }
stop_hostapd() { kill_if_running "$RUN_DIR/hostapd.pid"; }

iptables_add() {
  local up="$UPSTREAM_IFACE"
  [[ -n "$up" ]] || return 0
  # Avoid duplicates
  iptables -t nat -C POSTROUTING -o "$up" -m comment --comment "$IPTABLES_TAG" -j MASQUERADE 2>/dev/null || \
  iptables -t nat -A POSTROUTING -o "$up" -m comment --comment "$IPTABLES_TAG" -j MASQUERADE

  iptables -C FORWARD -i "$WIFI_IFACE" -o "$up" -m comment --comment "$IPTABLES_TAG" -j ACCEPT 2>/dev/null || \
  iptables -A FORWARD -i "$WIFI_IFACE" -o "$up" -m comment --comment "$IPTABLES_TAG" -j ACCEPT

  iptables -C FORWARD -i "$up" -o "$WIFI_IFACE" -m state --state RELATED,ESTABLISHED -m comment --comment "$IPTABLES_TAG" -j ACCEPT 2>/dev/null || \
  iptables -A FORWARD -i "$up" -o "$WIFI_IFACE" -m state --state RELATED,ESTABLISHED -m comment --comment "$IPTABLES_TAG" -j ACCEPT

  sysctl -w net.ipv4.ip_forward=1 >/dev/null
}

iptables_del() {
  local up="$UPSTREAM_IFACE"
  [[ -n "$up" ]] || return 0
  # Delete rules if present
  iptables -t nat -D POSTROUTING -o "$up" -m comment --comment "$IPTABLES_TAG" -j MASQUERADE 2>/dev/null || true
  iptables -D FORWARD -i "$WIFI_IFACE" -o "$up" -m comment --comment "$IPTABLES_TAG" -j ACCEPT 2>/dev/null || true
  iptables -D FORWARD -i "$up" -o "$WIFI_IFACE" -m state --state RELATED,ESTABLISHED -m comment --comment "$IPTABLES_TAG" -j ACCEPT 2>/dev/null || true
}

restart_running_ap() {
  stop_dnsmasq || true
  stop_hostapd || true
  apply_ip_setup
  start_dnsmasq
  start_hostapd
  if [[ "${NAT_ENABLED:-0}" == "1" && -n "${UPSTREAM_IFACE:-}" ]]; then
    iptables_add
  fi
}

ap_running() {
  [[ -f "$RUN_DIR/hostapd.pid" ]] && kill -0 "$(cat "$RUN_DIR/hostapd.pid" 2>/dev/null)" 2>/dev/null
}

menu() {
  whiptail --title "Offline Hotspot Manager" --menu "Choose an action" 20 70 10 \
    1 "Start Hotspot" \
    2 "Stop Hotspot" \
    3 "Status" \
    4 "Show Connected Clients" \
    5 "Change SSID/Password" \
    6 "Change Channel" \
    7 "Toggle Internet Sharing (NAT)" \
    8 "View Logs" \
    9 "Show DHCP Leases" \
    0 "Quit" 3>&1 1>&2 2>&3
}

start_hotspot() {
  nm_manage no
  # Kill wpa_supplicant on this iface if bound
  pkill -f "wpa_supplicant.*$WIFI_IFACE" 2>/dev/null || true
  apply_ip_setup
  start_dnsmasq
  start_hostapd
  if [[ "${NAT_ENABLED:-0}" == "1" && -n "${UPSTREAM_IFACE:-}" ]]; then
    iptables_add
  fi
  whiptail --msgbox "Hotspot started:\nSSID: $SSID\nIP: $AP_IP\nInterface: $WIFI_IFACE" 10 60
}

stop_hotspot() {
  stop_hostapd || true
  stop_dnsmasq || true
  iptables_del || true
  nm_manage yes
  whiptail --msgbox "Hotspot stopped and interface returned to NetworkManager." 8 60
}

status_hotspot() {
  local running="NO"
  ap_running && running="YES"
  local ip line
  ip=$(ip -4 addr show "$WIFI_IFACE" | awk '/inet /{print $2}' | head -n1)
  line="Running: $running
Interface: $WIFI_IFACE
SSID: $SSID
Channel: $CHANNEL
Country: $COUNTRY_CODE
AP IP/CIDR: ${ip:-$AP_CIDR}
NAT: ${NAT_ENABLED:-0}  Upstream: ${UPSTREAM_IFACE:-none}
Logs:
  hostapd: $LOG_HOSTAPD
  dnsmasq: $LOG_DNSMASQ"
  whiptail --msgbox "$line" 16 70
}

show_clients() {
  local tmp="/tmp/offline-ap-clients.$$"
  {
    echo "== Associated Wi-Fi Stations (iw) =="
    if command -v iw >/dev/null 2>&1; then
      iw dev "$WIFI_IFACE" station dump | awk '
        /^Station/ {mac=$2; print "\nMAC: "mac}
        /signal:/ {print "  " $0}
        /tx bitrate:/ {print "  " $0}
        /rx bitrate:/ {print "  " $0}
      '
    else
      echo "(iw not found)"
    fi
    echo
    echo "== DHCP Leases (dnsmasq) =="
    if [[ -f "$LEASES" ]]; then
      # Format: <expiry> <mac> <ip> <hostname> <client-id>
      awk '{printf "%-15s  %-17s  %-15s  %s\n", strftime("%Y-%m-%d %H:%M:%S",$1), $2, $3, ($4== "*" ? "-" : $4)}' "$LEASES"
    else
      echo "(no leases file yet)"
    fi
  } > "$tmp"
  whiptail --title "Connected Clients" --textbox "$tmp" 25 80
  rm -f "$tmp"
}

change_ssid_pass() {
  local new_ssid new_pass
  new_ssid=$(whiptail --inputbox "Enter new SSID" 10 60 "$SSID" 3>&1 1>&2 2>&3) || return 0
  while true; do
    new_pass=$(whiptail --passwordbox "Enter new WPA2 password (8–63 chars)" 10 60 3>&1 1>&2 2>&3) || return 0
    [[ ${#new_pass} -ge 8 && ${#new_pass} -le 63 ]] && break
    whiptail --msgbox "Invalid password length." 8 40
  done
  SSID="$new_ssid"
  PASSPHRASE="$new_pass"
  # Update hostapd config
  sed -i "s/^ssid=.*/ssid=$SSID/" "$HOSTAPD_CFG"
  sed -i "s/^wpa_passphrase=.*/wpa_passphrase=$PASSPHRASE/" "$HOSTAPD_CFG"
  save_env
  if ap_running; then
    restart_running_ap
    whiptail --msgbox "SSID/password updated and hotspot restarted." 8 50
  else
    whiptail --msgbox "SSID/password updated. Start the hotspot to apply." 8 60
  fi
}

change_channel() {
  local new_channel
  new_channel=$(whiptail --inputbox "Wi-Fi channel (1–11 for 2.4GHz)" 10 60 "$CHANNEL" 3>&1 1>&2 2>&3) || return 0
  [[ -z "$new_channel" ]] && return 0
  CHANNEL="$new_channel"
  sed -i "s/^channel=.*/channel=$CHANNEL/" "$HOSTAPD_CFG"
  save_env
  if ap_running; then
    restart_running_ap
    whiptail --msgbox "Channel updated and hotspot restarted." 8 50
  else
    whiptail --msgbox "Channel updated. Start the hotspot to apply." 8 60
  fi
}

toggle_nat() {
  if [[ "${NAT_ENABLED:-0}" == "0" ]]; then
    # Turn ON — pick upstream interface
    local ifs tmp="/tmp/offline-ap-ifaces.$$"
    ifs=$(ip -o link show | awk -F': ' '{print $2}' | grep -v "^lo$" | grep -v "^${WIFI_IFACE}$" || true)
    if [[ -z "$ifs" ]]; then
      whiptail --msgbox "No other interfaces found to share internet from." 8 60
      return 0
    fi
    printf "%s\n" $ifs | nl -w1 -s": " > "$tmp"
    local choice
    choice=$(whiptail --inputbox "Enter upstream interface to share internet from (e.g., eth0, wlan1, usb0):\n\n$(cat "$tmp")" 20 70 3>&1 1>&2 2>&3) || { rm -f "$tmp"; return 0; }
    rm -f "$tmp"
    if [[ -z "$choice" ]]; then return 0; fi
    UPSTREAM_IFACE="$choice"
    NAT_ENABLED="1"
    save_env
    if ap_running; then iptables_add; fi
    whiptail --msgbox "NAT enabled via $UPSTREAM_IFACE." 8 40
  else
    # Turn OFF
    if ap_running; then iptables_del; fi
    NAT_ENABLED="0"
    UPSTREAM_IFACE=""
    save_env
    whiptail --msgbox "NAT disabled." 8 30
  fi
}

view_logs() {
  local tmp="/tmp/offline-ap-logs.$$"
  {
    echo "==== hostapd (last 100 lines) ===="
    [[ -f "$LOG_HOSTAPD" ]] && tail -n 100 "$LOG_HOSTAPD" || echo "(no log yet)"
    echo
    echo "==== dnsmasq (last 100 lines) ===="
    [[ -f "$LOG_DNSMASQ" ]] && tail -n 100 "$LOG_DNSMASQ" || echo "(no log yet)"
  } > "$tmp"
  whiptail --title "Logs" --textbox "$tmp" 25 90
  rm -f "$tmp"
}

show_leases() {
  local tmp="/tmp/offline-ap-leases.$$"
  if [[ -f "$LEASES" ]]; then
    awk '{printf "%-20s %-17s %-15s %s\n", strftime("%Y-%m-%d %H:%M:%S",$1), $2, $3, ($4=="*"?"-":$4)}' "$LEASES" > "$tmp"
  else
    echo "(no leases yet)" > "$tmp"
  fi
  whiptail --title "DHCP Leases" --textbox "$tmp" 20 80
  rm -f "$tmp"
}

main() {
  need_root
  require_files
  load_env
  mkdir -p "$RUN_DIR"

  while true; do
    choice=$(menu) || exit 0
    case "$choice" in
      1) start_hotspot ;;
      2) stop_hotspot ;;
      3) status_hotspot ;;
      4) show_clients ;;
      5) change_ssid_pass ;;
      6) change_channel ;;
      7) toggle_nat ;;
      8) view_logs ;;
      9) show_leases ;;
      0) exit 0 ;;
    esac
  done
}

main "$@"

