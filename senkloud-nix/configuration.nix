# Edit this configuration file to define what should be installed on
# your system.  Help is available in the configuration.nix(5) man page
# and in the NixOS manual (accessible by running 'nixos-help').

{ config, pkgs, lib, ... }:

{
  imports =
    [ # Include the results of the hardware scan.
      ./hardware-configuration.nix
    ];

  # Bootloader.
  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  # docker configs
  virtualisation.docker.enable= true;

  networking.hostName = "senjoe"; # Define your hostname.
  # networking.wireless.enable = true;  # Enables wireless support via wpa_s>

  # Configure network proxy if necessary
  # networking.proxy.default = "http://user:password@proxy:port/";
  # networking.proxy.noProxy = "127.0.0.1,localhost,internal.domain";

  # Enable networking
  networking.networkmanager.enable = true;

  # Set your time zone.
  time.timeZone = "Africa/Dar_es_Salaam";
    # Select internationalisation properties.
  i18n.defaultLocale = "en_US.UTF-8";

  i18n.extraLocaleSettings = {
    LC_ADDRESS = "sw_TZ";
    LC_IDENTIFICATION = "sw_TZ";
    LC_MEASUREMENT = "sw_TZ";
    LC_MONETARY = "sw_TZ";
    LC_NAME = "sw_TZ";
    LC_NUMERIC = "sw_TZ";
    LC_PAPER = "sw_TZ";
    LC_TELEPHONE = "sw_TZ";
    LC_TIME = "sw_TZ";
  };

  # Configure keymap in X11
  services.xserver.xkb = {
    layout = "us";
    variant = "";
  };

  # Define a user account. Don't forget to set a password with 'passwd'.
  users.users.senjoe = {
    isNormalUser = true;
    description = "senjoe";
    extraGroups = [ "networkmanager" "wheel" "docker" "plugdev" "storage" ];
    packages = with pkgs; [];
  };

  # List packages installed in system profile. To search, run:
  # $ nix search wget
    environment.systemPackages = with pkgs; [
  #  vim # Do not forget to add an editor to edit configuration.nix! The Nan>
  #  wget
  docker
  git
  dnsmasq
  hostapd
  newt
  iproute2
  fish
  tailscale
  ani-cli
  ];

  # Some programs need SUID wrappers, can be configured further or are
  # started in user sessions.
  # programs.mtr.enable = true;
  # programs.gnupg.agent = {
  #   enable = true;
  #   enableSSHSupport = true;
  # };

  # List services that you want to enable:

  # Enable the OpenSSH daemon.
  services.openssh.enable = true;
  
  # dns services
  services.dnsmasq.enable = true;

  # senkloud private network setting
  #  services.hostapd.enable = true;
#  services.hostapd.radios = {
#    wlp0s21f0u2 = {
      # Remove the interface line - it's not needed in the new format
#      driver = "nl80211";
#      ssid = "senkloud";
#      band = "2.4GHz";
#      channel = 6;
#      wpa = 2;
#      wpaPassphrase = "kilimanjaro02";
#    };
#  };

  # Enable Tailscale VPN service
  services.tailscale.enable = true;

  # Docker service
  # virtualization.docker.enable = true;
  
  # external hardrive configurations
  # Enable udisks2 (optional, allows auto-mounting external drives manually)
  services.udisks2.enable = true;

  # Ensure user has access to mount points
  #users.users.senjoe.extraGroups = [ "wheel" "plugdev" "storage" ];

  # Main mount directories
  systemd.tmpfiles.rules = [
    "d /mnt/media2 0777 senjoe users -"
    "d /mnt/media2/movies 0777 senjoe users -"
    "d /mnt/media2/photos 0777 senjoe users -"
        "d /mnt/media2/uploads 0777 senjoe users -"
  ];

  # External drives (label-based, automatically mount when plugged)
  fileSystems."/mnt/media2/movies" = {
    device = "/dev/disk/by-label/senkloud_movies";
    fsType = "btrfs";
    options = [ "rw" "noatime" "compress=zstd" "noauto" "x-systemd.device-timeout=10s" ];
  };

  fileSystems."/mnt/media2/photos" = {
    device = "/dev/disk/by-label/senkloud_photos";
    fsType = "btrfs";
    options = [ "rw" "noatime" "compress=zstd" "noauto" "x-systemd.device-timeout=10s" ];
  };

  fileSystems."/mnt/media2/uploads" = {
    device = "/dev/disk/by-label/senkloud_uploads";
    fsType = "btrfs";
    options = [ "rw" "noatime" "compress=zstd" "noauto" "x-systemd.device-timeout=10s" ];
  };

  # Bind /mnt/media2 to /mnt/media for Senkloud consistency
  fileSystems."/mnt/media" = {
    device = "/mnt/media2";
    options = [ "bind" ];
  };

  # Open ports in the firewall.
  # networking.firewall.allowedTCPPorts = [ ... ];
  # networking.firewall.allowedUDPPorts = [ ... ];
    # Or disable the firewall altogether.
  # networking.firewall.enable = false;

  # This value determines the NixOS release from which the default
  # settings for stateful data, like file locations and database versions
  # on your system were taken. It's perfectly fine and recommended to leave
  # this value at the release version of the first install of this system.
  # Before changing this value read the documentation for this option
  # (e.g. man configuration.nix or on https://nixos.org/nixos/options.html).
  system.stateVersion = "25.05"; # Did you read the comment?

}