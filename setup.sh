#!/bin/bash

# Universal Media Server Setup Script for Debian/Ubuntu and Arch Linux
# This script downloads, installs, and configures everything needed for the media server

set -e

echo "🚀 Universal Media Server Setup Script"
echo "======================================"
echo "This script will:"
echo "  🔍 Detect your Linux distribution"
echo "  📦 Install Docker and dependencies"
echo "  👤 Configure user permissions"
echo "  📁 Create directory structure"
echo "  🔧 Download and setup media server"
echo "  🚀 Launch services"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should not be run as root for security reasons"
   echo "Please run as a regular user with sudo privileges"
   exit 1
fi

# Check sudo access
if ! sudo -v; then
    echo "❌ This script requires sudo privileges"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect Linux distribution
detect_distro() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        DISTRO=$ID
        VERSION=$VERSION_ID
    elif [[ -f /etc/arch-release ]]; then
        DISTRO="arch"
    elif [[ -f /etc/debian_version ]]; then
        DISTRO="debian"
    else
        print_error "Unable to detect Linux distribution"
        exit 1
    fi
    
    case $DISTRO in
        ubuntu|debian|pop|linuxmint|elementary)
            DISTRO_FAMILY="debian"
            ;;
        arch|manjaro|endeavouros|garuda)
            DISTRO_FAMILY="arch"
            ;;
        fedora|centos|rhel|rocky|almalinux)
            print_error "Red Hat-based distributions are not currently supported"
            print_status "Please install Docker manually and ensure docker-compose is available"
            exit 1
            ;;
        *)
            print_warning "Unknown distribution: $DISTRO"
            print_status "Attempting to detect package manager..."
            if command -v pacman &>/dev/null; then
                DISTRO_FAMILY="arch"
                print_status "Detected Arch-based system via pacman"
            elif command -v apt &>/dev/null; then
                DISTRO_FAMILY="debian"
                print_status "Detected Debian-based system via apt"
            else
                print_error "Unable to determine package manager"
                exit 1
            fi
            ;;
    esac
    
    print_success "Detected: $DISTRO_FAMILY-based system ($DISTRO)"
}

# Install Docker on Debian/Ubuntu systems
install_docker_debian() {
    print_status "Installing Docker on Debian/Ubuntu system..."
    
    # Update package index
    sudo apt update
    
    # Install prerequisites
    sudo apt install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/$DISTRO/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Set up Docker repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$DISTRO \
        $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Update package index with Docker repo
    sudo apt update
    
    # Install Docker
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Also install standalone docker-compose for compatibility
    if ! command -v docker-compose &>/dev/null; then
        print_status "Installing docker-compose via pip as fallback..."
        sudo apt install -y python3-pip
        sudo pip3 install docker-compose
    fi
}

# Install Docker on Arch systems
install_docker_arch() {
    print_status "Installing Docker on Arch system..."
    
    # Update package database
    sudo pacman -Sy
    
    # Install Docker and docker-compose
    sudo pacman -S --noconfirm docker docker-compose
}

# Check and install system dependencies
install_system_deps() {
    print_status "Installing system dependencies for $DISTRO_FAMILY..."
    
    case $DISTRO_FAMILY in
        debian)
            # Update package index
            sudo apt update
            
            # Define packages for Debian/Ubuntu
            local packages=(
                "python3"
                "python3-pip"
                "curl"
                "git"
                "unzip" 
                "ffmpeg"
            )
            
            local to_install=()
            
            for package in "${packages[@]}"; do
                if ! dpkg -l | grep -q "^ii  $package "; then
                    to_install+=("$package")
                fi
            done
            
            if [[ ${#to_install[@]} -gt 0 ]]; then
                print_status "Installing packages: ${to_install[*]}"
                sudo apt install -y "${to_install[@]}"
            else
                print_success "All required packages are already installed"
            fi
            
            # Install Docker if not present
            if ! command -v docker &>/dev/null; then
                install_docker_debian
            else
                print_success "Docker is already installed"
            fi
            ;;
            
        arch)
            # Update package database
            sudo pacman -Sy
            
            # Define packages for Arch
            local packages=(
                "docker"
                "docker-compose"
                "python"
                "python-pip"
                "curl"
                "git"
                "unzip"
                "ffmpeg"
            )
            
            local to_install=()
            
            for package in "${packages[@]}"; do
                if ! pacman -Qi "$package" &>/dev/null; then
                    to_install+=("$package")
                fi
            done
            
            if [[ ${#to_install[@]} -gt 0 ]]; then
                print_status "Installing packages: ${to_install[*]}"
                sudo pacman -S --noconfirm "${to_install[@]}"
            else
                print_success "All required packages are already installed"
            fi
            ;;
    esac
    
    # Enable and start Docker service (universal)
    print_status "Configuring Docker service..."
    sudo systemctl enable docker
    sudo systemctl start docker
    
    # Add user to docker group
    if ! groups | grep -q docker; then
        print_status "Adding user to docker group..."
        sudo usermod -aG docker "$USER"
        print_warning "You may need to log out and back in for docker group changes to take effect"
        print_status "Attempting to use newgrp as workaround..."
        # Try to activate group membership in current session
        if command -v newgrp &>/dev/null; then
            exec newgrp docker "$0" "$@"
        fi
    fi
    
    print_success "System dependencies installed successfully"
}

# Download application files if they don't exist
download_app_files() {
    print_status "Setting up application files..."
    
    # Create requirements.txt if it doesn't exist
    if [[ ! -f "requirements.txt" ]]; then
        print_status "Creating requirements.txt..."
        cat > requirements.txt << 'EOF'
Flask==3.0.0
Flask-Login==0.6.3
Werkzeug==3.0.1
Pillow==10.1.0
requests==2.31.0
EOF
    fi
    
    # Create Dockerfile if it doesn't exist
    if [[ ! -f "Dockerfile" ]]; then
        print_status "Creating Dockerfile..."
        cat > Dockerfile << 'EOF'
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libmagic1 \
    build-essential \
    pkg-config \
    libffi-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app.py .
COPY templates/ templates/
COPY static/ static/

# Create necessary directories
RUN mkdir -p /app/data /app/static/thumbnails

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app

# Switch to non-root user
USER app

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/ || exit 1

# Run the application
CMD ["python", "app.py"]
EOF
    fi
    
    # Create static directory
    mkdir -p static/thumbnails
    
    print_success "Application files prepared"
}

# Generate docker-compose.yml with simplified secret
create_docker_compose() {
    print_status "Creating docker-compose.yml..."
    
    # Use a simple static secret for local usage
    local SECRET_KEY="local-media-server-secret-key"
    
    cat > docker-compose.yml << EOF
version: '3.8'

services:
  jellyfin:
    image: jellyfin/jellyfin:latest
    container_name: jellyfin
    restart: unless-stopped
    ports:
      - "8096:8096"
    volumes:
      # Jellyfin config and cache
      - jellyfin_config:/config
      - jellyfin_cache:/cache
      # Media directories - mapped to the same structure as Flask app
      - /mnt/media:/media:ro
    environment:
      - JELLYFIN_PublishedServerUrl=http://localhost:8096
    networks:
      - media_network
    # Optional: Hardware acceleration for transcoding
    # devices:
    #   - /dev/dri:/dev/dri # Intel GPU
    # group_add:
    #   - "109" # render group for GPU access

  flask-media-manager:
    build: 
      context: .
      dockerfile: Dockerfile
    container_name: flask-media-manager
    restart: unless-stopped
    ports:
      - "5000:5000"
    volumes:
      # Media directory with write access
      - /mnt/media:/mnt/media
      # Persistent storage for user data and thumbnails
      - flask_data:/app/data
      - flask_thumbnails:/app/static/thumbnails
    environment:
      - SECRET_KEY=$SECRET_KEY
      - JELLYFIN_URL=http://jellyfin:8096
      - JELLYFIN_API_KEY=  # Set this after configuring Jellyfin
      - FLASK_ENV=production
      - PYTHONUNBUFFERED=1
    depends_on:
      - jellyfin
    networks:
      - media_network
    # Ensure media directories exist with correct permissions
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
EOF
    
    print_success "docker-compose.yml created with simple local secret"
}

# Create media directory structure with proper permissions
create_media_dirs() {
    print_status "Creating media directory structure..."
    
    # Create main media directory and subdirectories
    sudo mkdir -p /mnt/media/{Pictures,Movies,Music}
    
    # Set ownership to current user
    sudo chown -R "$USER:$USER" /mnt/media
    
    # Set proper permissions (read/write for user, read for group/others)
    sudo chmod -R 755 /mnt/media
    
    # Also ensure user can write to /mnt if it doesn't exist
    if [[ ! -d /mnt ]]; then
        sudo mkdir -p /mnt
        sudo chown root:root /mnt
        sudo chmod 755 /mnt
    fi
    
    print_success "Media directories created at /mnt/media"
    echo "  📁 /mnt/media/Pictures (for images)"
    echo "  📁 /mnt/media/Movies (for videos)"
    echo "  📁 /mnt/media/Music (for audio)"
    echo "  👤 Owner: $USER:$USER"
    echo "  🔐 Permissions: 755 (rwxr-xr-x)"
}

# Test Docker functionality
test_docker() {
    print_status "Testing Docker functionality..."
    
    # Test basic docker command
    if ! docker --version &>/dev/null; then
        print_error "Docker command failed"
        print_warning "You may need to log out and back in for group membership to take effect"
        print_status "Trying alternative approach..."
        
        # Try with sudo as fallback
        if sudo docker --version &>/dev/null; then
            print_warning "Docker works with sudo, but user permissions may need adjustment"
            print_status "Continuing with setup..."
            docker_permission_issue=true
        else
            print_error "Docker is not working properly"
            exit 1
        fi
    fi
    
    # Test docker-compose (try multiple variants)
    local compose_working=false
    
    # Try docker compose (new plugin syntax)
    if docker compose version &>/dev/null; then
        COMPOSE_CMD="docker compose"
        compose_working=true
    # Try docker-compose (standalone)
    elif docker-compose --version &>/dev/null; then
        COMPOSE_CMD="docker-compose"
        compose_working=true
    # Try with sudo
    elif sudo docker compose version &>/dev/null; then
        COMPOSE_CMD="sudo docker compose"
        compose_working=true
        docker_permission_issue=true
    elif sudo docker-compose --version &>/dev/null; then
        COMPOSE_CMD="sudo docker-compose"
        compose_working=true
        docker_permission_issue=true
    fi
    
    if [[ "$compose_working" != true ]]; then
        print_error "Docker Compose is not working properly"
        print_status "Available compose commands:"
        echo "  - docker compose version: $(docker compose version 2>&1 || echo "Failed")"
        echo "  - docker-compose --version: $(docker-compose --version 2>&1 || echo "Failed")"
        exit 1
    fi
    
    print_success "Docker is functional (using: $COMPOSE_CMD)"
}

# Verify all required files exist
verify_files() {
    print_status "Verifying all required files..."
    
    local required_files=("docker-compose.yml" "Dockerfile" "requirements.txt" "app.py")
    local missing_files=()
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            missing_files+=("$file")
        fi
    done
    
    if [[ ${#missing_files[@]} -gt 0 ]]; then
        print_error "Missing required files:"
        printf '  - %s\n' "${missing_files[@]}"
        print_status "Please ensure you have placed app.py and templates/ directory in the current directory"
        exit 1
    fi
    
    # Check template directory
    if [[ ! -d "templates" ]]; then
        print_error "templates/ directory is missing"
        print_status "Please ensure you have copied the templates/ directory to the current location"
        exit 1
    fi
    
    # Check if templates contain required files
    local template_files=("base.html" "login.html" "gallery.html" "upload.html" "admin.html")
    local missing_templates=()
    
    for template in "${template_files[@]}"; do
        if [[ ! -f "templates/$template" ]]; then
            missing_templates+=("templates/$template")
        fi
    done
    
    if [[ ${#missing_templates[@]} -gt 0 ]]; then
        print_warning "Some template files are missing:"
        printf '  - %s\n' "${missing_templates[@]}"
        print_status "The application may not work properly without all templates"
    fi
    
    print_success "All required files are present"
}

# Pull Docker images to avoid long wait during first startup
pre_pull_images() {
    print_status "Pre-downloading Docker images (this may take a few minutes)..."
    
    # Use the determined docker command
    local docker_cmd="docker"
    if [[ -n "${docker_permission_issue:-}" ]]; then
        docker_cmd="sudo docker"
        print_status "Using sudo for Docker commands"
    fi
    
    # Pull Jellyfin image
    print_status "Downloading Jellyfin image..."
    $docker_cmd pull jellyfin/jellyfin:latest
    
    # Pull Python base image for building
    print_status "Downloading Python base image..."
    $docker_cmd pull python:3.11-slim
    
    print_success "Docker images downloaded successfully"
}

# Build the Flask application image
build_flask_image() {
    print_status "Building Flask application Docker image..."
    
    # Use the determined compose command
    $COMPOSE_CMD build flask-media-manager
    
    print_success "Flask application image built successfully"
}

# Start services with appropriate permissions
start_services() {
    print_status "Starting Docker services..."
    
    # Start services
    print_status "Starting Jellyfin and Flask Media Manager..."
    $COMPOSE_CMD up -d
    
    print_success "Services started successfully!"
}

# Enhanced service status check
show_status() {
    print_status "Service Status:"
    
    $COMPOSE_CMD ps
    
    echo ""
    print_status "Service URLs:"
    echo "  🌐 Flask Media Manager: http://localhost:5000"
    echo "  📺 Jellyfin: http://localhost:8096"
    
    echo ""
    print_status "Default Login Credentials:"
    echo "  👤 Username: admin"
    echo "  🔐 Password: admin123"
    echo "  ⚠️  Please change these credentials after first login!"
    
    echo ""
    print_status "Directory Information:"
    echo "  📁 Media Storage: /mnt/media/"
    echo "  🔧 Configuration: Docker volumes"
    echo "  🖼️  Thumbnails: Docker volume (flask_thumbnails)"
}

# Enhanced wait for services with better error handling
wait_for_services() {
    print_status "Waiting for services to start..."
    
    # Wait for Flask app with better error checking
    print_status "Waiting for Flask Media Manager..."
    local timeout=120
    local flask_ready=false
    
    while [ $timeout -gt 0 ] && [ "$flask_ready" = false ]; do
        if curl -f -s http://localhost:5000 >/dev/null 2>&1; then
            flask_ready=true
            print_success "Flask Media Manager is ready"
        else
            sleep 3
            timeout=$((timeout-3))
            echo -n "."
        fi
    done
    
    if [ "$flask_ready" = false ]; then
        print_warning "Flask Media Manager may not be ready yet (timeout after 2 minutes)"
        print_status "You can check logs with: $COMPOSE_CMD logs flask-media-manager"
    fi
    
    # Wait for Jellyfin
    print_status "Waiting for Jellyfin..."
    timeout=120
    local jellyfin_ready=false
    
    while [ $timeout -gt 0 ] && [ "$jellyfin_ready" = false ]; do
        if curl -f -s http://localhost:8096 >/dev/null 2>&1; then
            jellyfin_ready=true
            print_success "Jellyfin is ready"
        else
            sleep 3
            timeout=$((timeout-3))
            echo -n "."
        fi
    done
    
    if [ "$jellyfin_ready" = false ]; then
        print_warning "Jellyfin may not be ready yet (timeout after 2 minutes)"
        print_status "You can check logs with: $COMPOSE_CMD logs jellyfin"
    fi
    
    echo # New line after dots
}

# Enhanced post-setup instructions
show_instructions() {
    echo ""
    echo "============================================"
    print_success "🎉 SETUP COMPLETE! 🎉"
    echo "============================================"
    echo ""
    echo "🖥️  System: $DISTRO_FAMILY-based ($DISTRO)"
    echo "🐳 Docker: $COMPOSE_CMD"
    echo "📋 Your media server is now running!"
    echo ""
    echo "🌐 ACCESS YOUR SERVICES:"
    echo "   • Flask Media Manager: http://localhost:5000"
    echo "   • Jellyfin Media Server: http://localhost:8096"
    echo ""
    echo "🔑 DEFAULT LOGIN (Flask Media Manager):"
    echo "   • Username: admin"
    echo "   • Password: admin123"
    echo "   • ⚠️  IMPORTANT: Change this password immediately!"
    echo ""
    echo "📁 MEDIA DIRECTORIES CREATED:"
    echo "   • Images: /mnt/media/Pictures"
    echo "   • Videos: /mnt/media/Movies"
    echo "   • Audio: /mnt/media/Music"
    echo ""
    echo "🚀 NEXT STEPS:"
    echo ""
    echo "1. 🔧 CONFIGURE JELLYFIN:"
    echo "   • Visit: http://localhost:8096"
    echo "   • Complete the setup wizard"
    echo "   • When adding libraries, use these paths:"
    echo "     - Pictures: /media/Pictures"
    echo "     - Movies: /media/Movies"
    echo "     - Music: /media/Music"
    echo ""
    echo "2. 📱 USE MEDIA MANAGER:"
    echo "   • Visit: http://localhost:5000"
    echo "   • Login with admin/admin123"
    echo "   • Upload files using the web interface"
    echo "   • Create folders like 'Anime/CowboyBebop' or 'Movies/Action'"
    echo ""
    echo "3. 🔑 OPTIONAL - JELLYFIN API INTEGRATION:"
    echo "   • In Jellyfin: Dashboard → API Keys → Create new key"
    echo "   • Edit docker-compose.yml and set JELLYFIN_API_KEY"
    echo "   • Restart: $COMPOSE_CMD restart flask-media-manager"
    echo ""
    echo "🛠️  MANAGEMENT COMMANDS:"
    echo "   • View logs: $COMPOSE_CMD logs -f"
    echo "   • Stop services: $COMPOSE_CMD down"
    echo "   • Start services: $COMPOSE_CMD up -d"
    echo "   • Restart services: $COMPOSE_CMD restart"
    echo "   • Update: $COMPOSE_CMD pull && $COMPOSE_CMD up -d"
    echo ""
    echo "📊 SERVICE STATUS:"
    echo "   • Check status: $COMPOSE_CMD ps"
    echo "   • Flask logs: $COMPOSE_CMD logs flask-media-manager"
    echo "   • Jellyfin logs: $COMPOSE_CMD logs jellyfin"
    echo ""
    echo "🔒 SECURITY NOTES:"
    echo "   • This setup is designed for LOCAL USE ONLY"
    echo "   • Change the default admin password"
    echo "   • Don't expose these services to the internet"
    echo ""
    echo "🎯 FEATURES YOU CAN USE:"
    echo "   • Upload media through web interface"
    echo "   • Create nested folders (Movies/Action/2023)"
    echo "   • Automatic thumbnail generation"
    echo "   • Stream media through Jellyfin"
    echo "   • Bulk file operations"
    echo "   • User management (admin panel)"
    echo ""
    if [[ -n "${docker_permission_issue:-}" ]]; then
        echo "⚠️  DOCKER PERMISSIONS:"
        echo "   • You may need to log out and back in for docker group membership"
        echo "   • Or restart your session/terminal"
        echo "   • If issues persist, use: sudo [docker-command]"
        echo ""
    fi
    print_success "🎬 Enjoy your media server! Happy streaming! 🍿"
}

# Complete setup process
complete_setup() {
    print_status "🚀 Starting complete media server setup..."
    echo ""
    
    detect_distro
    echo ""
    
    install_system_deps
    echo ""
    
    download_app_files
    echo ""
    
    create_docker_compose
    echo ""
    
    verify_files
    echo ""
    
    create_media_dirs
    echo ""
    
    test_docker
    echo ""
    
    pre_pull_images
    echo ""
    
    build_flask_image
    echo ""
    
    start_services
    echo ""
    
    wait_for_services
    echo ""
    
    show_status
    echo ""
    
    show_instructions
}

# Main execution with enhanced functionality
main() {
    # Initialize global variables
    COMPOSE_CMD=""
    DISTRO=""
    DISTRO_FAMILY=""
    
    case "${1:-setup}" in
        setup|install|complete)
            complete_setup
            ;;
        start)
            if [[ ! -f "docker-compose.yml" ]]; then
                print_error "docker-compose.yml not found. Run './setup.sh setup' first."
                exit 1
            fi
            detect_distro
            test_docker
            print_status "Starting services..."
            $COMPOSE_CMD up -d
            wait_for_services
            show_status
            ;;
        stop)
            if [[ ! -f "docker-compose.yml" ]]; then
                print_error "docker-compose.yml not found. Run './setup.sh setup' first."
                exit 1
            fi
            detect_distro
            test_docker
            print_status "Stopping services..."
            $COMPOSE_CMD down
            print_success "Services stopped"
            ;;
        restart)
            if [[ ! -f "docker-compose.yml" ]]; then
                print_error "docker-compose.yml not found. Run './setup.sh setup' first."
                exit 1
            fi
            detect_distro
            test_docker
            print_status "Restarting services..."
            $COMPOSE_CMD restart
            wait_for_services
            print_success "Services restarted"
            ;;
        status)
            if [[ ! -f "docker-compose.yml" ]]; then
                print_error "docker-compose.yml not found. Run './setup.sh setup' first."
                exit 1
            fi
            detect_distro
            test_docker
            show_status
            ;;
        logs)
            if [[ ! -f "docker-compose.yml" ]]; then
                print_error "docker-compose.yml not found. Run './setup.sh setup' first."
                exit 1
            fi
            detect_distro
            test_docker
            if [[ -n "${2:-}" ]]; then
                print_status "Showing logs for ${2}..."
                $COMPOSE_CMD logs -f "$2"
            else
                print_status "Showing all service logs..."
                $COMPOSE_CMD logs -f
            fi
            ;;
        update)
            if [[ ! -f "docker-compose.yml" ]]; then
                print_error "docker-compose.yml not found. Run './setup.sh setup' first."
                exit 1
            fi
            detect_distro
            test_docker
            print_status "Updating containers..."
            $COMPOSE_CMD pull
            $COMPOSE_CMD up -d --build
            wait_for_services
            print_success "Containers updated"
            ;;
        rebuild)
            if [[ ! -f "docker-compose.yml" ]]; then
                print_error "docker-compose.yml not found. Run './setup.sh setup' first."
                exit 1
            fi
            detect_distro
            test_docker
            print_status "Rebuilding Flask application..."
            $COMPOSE_CMD build --no-cache flask-media-manager
            $COMPOSE_CMD up -d flask-media-manager
            wait_for_services
            print_success "Flask application rebuilt"
            ;;
        clean)
            if [[ ! -f "docker-compose.yml" ]]; then
                print_error "docker-compose.yml not found. Nothing to clean."
                exit 1
            fi
            detect_distro
            test_docker
            print_warning "This will remove all containers and volumes!"
            print_warning "Your media files in /mnt/media will NOT be deleted."
            print_warning "But Jellyfin config and Flask user data WILL be lost!"
            echo ""
            read -p "Are you sure? Type 'yes' to confirm: " -r
            echo
            if [[ $REPLY == "yes" ]]; then
                print_status "Stopping and removing containers..."
                $COMPOSE_CMD down -v
                print_status "Removing unused Docker resources..."
                local docker_cmd="docker"
                if [[ -n "${docker_permission_issue:-}" ]]; then
                    docker_cmd="sudo docker"
                fi
                if $docker_cmd system prune -f &>/dev/null; then
                    print_success "Cleanup complete"
                    echo ""
                    print_status "To rebuild everything, run: ./setup.sh setup"
                else
                    print_warning "Some cleanup operations may have failed"
                fi
            else
                print_status "Cleanup cancelled"
            fi
            ;;
        reset-permissions)
            print_status "Resetting media directory permissions..."
            sudo chown -R "$USER:$USER" /mnt/media
            sudo chmod -R 755 /mnt/media
            print_success "Permissions reset"
            ;;
        check-deps)
            print_status "Checking system dependencies..."
            detect_distro
            install_system_deps
            test_docker
            print_success "Dependencies check complete"
            ;;
        *)
            echo "Usage: $0 {setup|start|stop|restart|status|logs|update|rebuild|clean|reset-permissions|check-deps}"
            echo ""
            echo "🚀 SETUP COMMANDS:"
            echo "  setup/install/complete - Full installation and setup"
            echo "  check-deps            - Install/check system dependencies only"
            echo ""
            echo "📋 MANAGEMENT COMMANDS:"
            echo "  start                 - Start all services"
            echo "  stop                  - Stop all services"
            echo "  restart               - Restart all services"
            echo "  status                - Show service status and URLs"
            echo ""
            echo "🔍 MONITORING COMMANDS:"
            echo "  logs [service]        - Show logs (all services or specific service)"
            echo "                         Examples: './setup.sh logs' or './setup.sh logs jellyfin'"
            echo ""
            echo "🔧 MAINTENANCE COMMANDS:"
            echo "  update                - Update and restart containers"
            echo "  rebuild               - Rebuild Flask application (after code changes)"
            echo "  reset-permissions     - Fix media directory permissions"
            echo ""
            echo "🗑️  CLEANUP COMMANDS:"
            echo "  clean                 - Remove all containers and volumes (DESTRUCTIVE)"
            echo ""
            echo "💡 EXAMPLES:"
            echo "  ./setup.sh setup      # Complete installation"
            echo "  ./setup.sh status     # Check if services are running"
            echo "  ./setup.sh logs flask-media-manager  # View Flask app logs"
            echo "  ./setup.sh restart    # Restart all services"
            echo ""
            echo "🖥️  SUPPORTED SYSTEMS:"
            echo "  • Debian/Ubuntu (and derivatives like Pop!_OS, Linux Mint)"
            echo "  • Arch Linux (and derivatives like Manjaro, EndeavourOS)"
            echo "  • Automatic distribution detection and package manager selection"
            echo ""
            exit 1
            ;;
    esac
}

# Check if this script is being executed or sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being executed directly
    main "$@"
fi