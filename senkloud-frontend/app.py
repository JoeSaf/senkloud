#!/usr/bin/env python3
"""
Flask Media Manager with Enhanced Video Playback
A lightweight web application for uploading and managing media files
with intelligent video playback options (browser vs external player).
"""

import os
import json
import hashlib
import mimetypes
import subprocess
import re
from datetime import datetime, timedelta
from pathlib import Path
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, send_file, abort, Response, session
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from PIL import Image, ImageOps
from flask_cors import CORS
import requests
from typing import List, Dict, Any, Optional, Tuple


import secrets
import time

# Add to Config class
class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key-change-this'
    UPLOAD_FOLDER = '/mnt/media'
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024 * 1024  # 10GB max file size
    ALLOWED_EXTENSIONS = {
        'image': {'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg'},
        'video': {'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'},
        'audio': {'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus'},
        'document': {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'md', 'csv', 'odt', 'ods', 'odp'},
        'code': {'py', 'js', 'ts', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'sh', 'php', 'java', 'cpp', 'h', 'sql'},
        'archive': {'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'tbz2', 'txz'}
    }
    JELLYFIN_URL = os.environ.get('JELLYFIN_URL', 'http://localhost:8096')
    JELLYFIN_API_KEY = os.environ.get('JELLYFIN_API_KEY', '')
    THUMBNAIL_SIZE = (300, 300)
    USERS_FILE = 'users.json'
    FOLDER_THUMBNAILS_FILE = 'folder_thumbnails.json'
    
    # Enhanced video streaming settings
    CHUNK_SIZE = 8192 * 4  # 32KB chunks for better streaming
    
    # Video codec compatibility settings for browser playback
    WEB_COMPATIBLE_CODECS = {
        'video': ['h264', 'avc1', 'vp8', 'vp9', 'av01'],
        'audio': ['aac', 'mp3', 'opus', 'vorbis', 'mp4a'],
        'containers': ['mp4', 'webm', 'ogg', 'mov']
    }
    
    # File size limits by type (in bytes)
    FILE_SIZE_LIMITS = {
        'image': 100 * 1024 * 1024,      # 100MB for images
        'video': 10 * 1024 * 1024 * 1024, # 10GB for videos
        'audio': 500 * 1024 * 1024,       # 500MB for audio
        'document': 5 * 1024 * 1024 * 1024,     # 5GB for documents
        'code': 1 * 1024 * 1024 * 1024,         # 1GB for code files
        'archive': 1 * 1024 * 1024 * 1024  # 1GB for archives
    }
    
    # Token-based streaming for external players
    STREAM_TOKEN_EXPIRY = 3600  # 1 hour

# Global token storage (in production, use Redis or database)
streaming_tokens = {}

# Flask app setup
app = Flask(__name__)
app.config.from_object(Config)
app.config.update(
    SESSION_COOKIE_SECURE=False,  # Set to True if using HTTPS
    SESSION_COOKIE_HTTPONLY=True,  # Prevents JavaScript access (security)
    SESSION_COOKIE_SAMESITE='Lax',  # Allows cross-origin requests within same site
    SESSION_PERMANENT=True,  # Make sessions permanent
    PERMANENT_SESSION_LIFETIME=timedelta(days=7),  # Session lasts 7 days
    SESSION_COOKIE_DOMAIN=None,  # Allow cookies on any domain/IP in network
    SESSION_COOKIE_PATH='/', 
)

# Enable CORS with credentials support
CORS(app, 
     supports_credentials=True, 
     origins=['*'],  # Or specify your network IPs like ['http://192.168.1.100:3000', 'http://192.168.1.101:3000']
     allow_headers=['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
)

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'

# User model
class User(UserMixin):
    def __init__(self, id, username, password_hash, is_admin=False):
        self.id = id
        self.username = username
        self.password_hash = password_hash
        self.is_admin = is_admin

# User management (keeping original implementation)
class UserManager:
    def __init__(self, users_file):
        self.users_file = users_file
        self.users = self.load_users()

    def load_users(self):
        if os.path.exists(self.users_file):
            try:
                with open(self.users_file, 'r') as f:
                    data = json.load(f)
                    return {
                        user_id: User(
                            user_id, 
                            user_data['username'], 
                            user_data['password_hash'],
                            user_data.get('is_admin', False)
                        )
                        for user_id, user_data in data.items()
                    }
            except (json.JSONDecodeError, KeyError):
                pass
        return {}

    def save_users(self):
        data = {
            user_id: {
                'username': user.username,
                'password_hash': user.password_hash,
                'is_admin': user.is_admin
            }
            for user_id, user in self.users.items()
        }
        with open(self.users_file, 'w') as f:
            json.dump(data, f, indent=2)

    def create_user(self, username, password, is_admin=False):
        user_id = str(len(self.users) + 1)
        password_hash = generate_password_hash(password)
        user = User(user_id, username, password_hash, is_admin)
        self.users[user_id] = user
        self.save_users()
        return user

    def get_user(self, user_id):
        return self.users.get(user_id)

    def get_user_by_username(self, username):
        for user in self.users.values():
            if user.username == username:
                return user
        return None

    def verify_password(self, username, password):
        user = self.get_user_by_username(username)
        if user and check_password_hash(user.password_hash, password):
            return user
        return None

# Initialize user manager
user_manager = UserManager(Config.USERS_FILE)

# Create default admin user if no users exist
if not user_manager.users:
    user_manager.create_user('admin', 'admin123', is_admin=True)
    print("Created default admin user: admin/admin123")

@login_manager.user_loader
def load_user(user_id):
    return user_manager.get_user(user_id)

# Enhanced utility functions for video handling
def get_video_info(file_path):
    """Get video file information using ffprobe"""
    try:
        cmd = [
            'ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', file_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            info = json.loads(result.stdout)
            video_stream = None
            audio_stream = None
            
            # Find video and audio streams
            for stream in info.get('streams', []):
                if stream.get('codec_type') == 'video' and not video_stream:
                    video_stream = stream
                elif stream.get('codec_type') == 'audio' and not audio_stream:
                    audio_stream = stream
            
            return {
                'format': info.get('format', {}),
                'video_stream': video_stream,
                'audio_stream': audio_stream,
                'duration': float(info.get('format', {}).get('duration', 0)),
                'size': int(info.get('format', {}).get('size', 0))
            }
    except Exception as e:
        print(f"Error getting video info for {file_path}: {e}")
    return None

def is_web_compatible(video_info):
    """Check if video is web-compatible for direct browser streaming"""
    if not video_info:
        return False
    
    format_name = video_info.get('format', {}).get('format_name', '').lower()
    video_stream = video_info.get('video_stream', {})
    audio_stream = video_info.get('audio_stream', {})
    
    # Check container format
    container_compatible = any(fmt in format_name for fmt in Config.WEB_COMPATIBLE_CODECS['containers'])
    
    # Check video codec
    video_codec = video_stream.get('codec_name', '').lower()
    video_compatible = video_codec in Config.WEB_COMPATIBLE_CODECS['video']
    
    # Check audio codec (if present)
    audio_codec = audio_stream.get('codec_name', '').lower() if audio_stream else 'none'
    audio_compatible = audio_codec in Config.WEB_COMPATIBLE_CODECS['audio'] or audio_codec == 'none'
    
    is_compatible = container_compatible and video_compatible and audio_compatible
    
    print(f"Video compatibility check for {video_info.get('format', {}).get('filename', 'unknown')}:")
    print(f"  Format: {format_name} -> {'✓' if container_compatible else '✗'}")
    print(f"  Video codec: {video_codec} -> {'✓' if video_compatible else '✗'}")
    print(f"  Audio codec: {audio_codec} -> {'✓' if audio_compatible else '✗'}")
    print(f"  Overall: {'Browser compatible' if is_compatible else 'External player recommended'}")
    
    return is_compatible

# Utility functions (keeping all original functions)
def allowed_file(filename):
    """Check if file extension is allowed"""
    if '.' not in filename:
        return False, None
    ext = filename.rsplit('.', 1)[1].lower()
    for file_type, extensions in Config.ALLOWED_EXTENSIONS.items():
        if ext in extensions:
            return True, file_type
    return False, None

def get_media_path(file_type):
    """Get the appropriate media directory based on file type"""
    paths = {
            'image': os.path.join(Config.UPLOAD_FOLDER, 'Pictures'),
            'video': os.path.join(Config.UPLOAD_FOLDER, 'Movies'),
            'audio': os.path.join(Config.UPLOAD_FOLDER, 'Music'),
            'document': os.path.join(Config.UPLOAD_FOLDER, 'Documents'),
            'code': os.path.join(Config.UPLOAD_FOLDER, 'Code'),
            'archive': os.path.join(Config.UPLOAD_FOLDER, 'Archives')
        }
    return paths.get(file_type, Config.UPLOAD_FOLDER)

def ensure_directory(path):
    """Ensure directory exists"""
    os.makedirs(path, exist_ok=True)

def sanitize_path_component(component):
    """Sanitize a single path component to prevent path traversal"""
    if not component:
        return None
    component = component.replace('..', '').replace('/', '').replace('\\', '')
    component = secure_filename(component)
    return component if component else None

def sanitize_folder_path(folder_path):
    """Sanitize a complete folder path (can contain multiple levels)"""
    if not folder_path:
        return ''
    
    components = []
    for part in folder_path.replace('\\', '/').split('/'):
        sanitized = sanitize_path_component(part)
        if sanitized:
            components.append(sanitized)
    
    return '/'.join(components)

def get_nested_folder_structure(base_path, max_depth=5):
    """Get nested folder structure for a media directory"""
    def scan_directory(path, relative_path='', current_depth=0):
        folders = []
        if current_depth >= max_depth or not os.path.exists(path):
            return folders
        
        try:
            for item in os.listdir(path):
                item_path = os.path.join(path, item)
                if os.path.isdir(item_path):
                    relative_item_path = os.path.join(relative_path, item) if relative_path else item
                    folder_info = {
                        'name': item,
                        'path': relative_item_path,
                        'full_path': item_path,
                        'depth': current_depth,
                        'children': scan_directory(item_path, relative_item_path, current_depth + 1)
                    }
                    folders.append(folder_info)
        except (OSError, PermissionError):
            pass
        
        return sorted(folders, key=lambda x: x['name'].lower())
    
    return scan_directory(base_path)

def get_all_folder_paths(base_path, max_depth=5):
    """Get all folder paths as a flat list for dropdowns"""
    def collect_paths(folders, paths=None):
        if paths is None:
            paths = []
        
        for folder in folders:
            paths.append({
                'name': folder['name'],
                'path': folder['path'],
                'display_name': folder['path'].replace('/', ' → '),
                'depth': folder['depth']
            })
            if folder['children']:
                collect_paths(folder['children'], paths)
        
        return paths
    
    nested_structure = get_nested_folder_structure(base_path, max_depth)
    return collect_paths(nested_structure)


# custom thumbnail logic
def load_folder_thumbnails():
    """Load folder thumbnails from persistent storage"""
    try:
        if os.path.exists(Config.FOLDER_THUMBNAILS_FILE):
            with open(Config.FOLDER_THUMBNAILS_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading folder thumbnails: {e}")
    return {}

def save_folder_thumbnails(thumbnails):
    """Save folder thumbnails to persistent storage"""
    try:
        with open(Config.FOLDER_THUMBNAILS_FILE, 'w') as f:
            json.dump(thumbnails, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving folder thumbnails: {e}")
        return False

def get_folder_thumbnail(folder_path, file_type):
    """Get thumbnail for a folder with inheritance logic"""
    folder_thumbnails = load_folder_thumbnails()
    
    # Normalize folder path
    if folder_path == '' or folder_path == 'Root':
        folder_key = f"{file_type}/Root"
    else:
        folder_key = f"{file_type}/{folder_path}"
    
    # Check for exact match first
    if folder_key in folder_thumbnails:
        return folder_thumbnails[folder_key]
    
    # Check for inheritance from parent folders
    path_parts = folder_path.split('/') if folder_path != 'Root' else []
    for i in range(len(path_parts) - 1, -1, -1):
        parent_path = '/'.join(path_parts[:i]) if i > 0 else 'Root'
        parent_key = f"{file_type}/{parent_path}"
        
        if parent_key in folder_thumbnails:
            # Check if inheritance is enabled for this parent
            parent_data = folder_thumbnails[parent_key]
            if isinstance(parent_data, dict) and parent_data.get('inherit_to_children', False):
                return parent_data.get('thumbnail_url')
            elif isinstance(parent_data, str):
                # Legacy format - assume no inheritance
                continue
    
    # No custom thumbnail found, try to use first image/video in folder
    return get_auto_folder_thumbnail(folder_path, file_type)

def get_auto_folder_thumbnail(folder_path, file_type):
    """Generate automatic folder thumbnail from first suitable file"""
    media_dir = get_media_path(file_type)
    full_path = os.path.join(media_dir, folder_path) if folder_path != 'Root' else media_dir
    
    if not os.path.exists(full_path):
        return None
    
    try:
        # Get all files in the folder
        files = []
        for item in os.listdir(full_path):
            item_path = os.path.join(full_path, item)
            if os.path.isfile(item_path):
                is_allowed, detected_type = allowed_file(item)
                if is_allowed and detected_type in ['image', 'video']:
                    files.append((item, detected_type, item_path))
        
        # Sort files - prioritize images over videos, then alphabetically
        files.sort(key=lambda x: (x[1] != 'image', x[0].lower()))
        
        if files:
            _, _, file_path = files[0]
            # Generate thumbnail hash
            thumbnail_filename = f"{hashlib.md5(file_path.encode()).hexdigest()}.jpg"
            thumbnail_path = os.path.join(app.static_folder, 'thumbnails', thumbnail_filename)
            
            # Generate thumbnail if it doesn't exist
            if not os.path.exists(thumbnail_path):
                if generate_thumbnail(file_path, files[0][1], thumbnail_path):
                    return thumbnail_filename
            else:
                return thumbnail_filename
    
    except Exception as e:
        print(f"Error generating auto folder thumbnail: {e}")
    
    return None


def scan_media_files(base_path, folder_path=''):
    """Recursively scan media files in a directory"""
    media_files = []
    scan_path = os.path.join(base_path, folder_path) if folder_path else base_path
    
    if not os.path.exists(scan_path):
        return media_files
    
    try:
        for item in os.listdir(scan_path):
            item_path = os.path.join(scan_path, item)
            relative_path = os.path.join(folder_path, item) if folder_path else item
            
            if os.path.isfile(item_path):
                is_allowed, detected_type = allowed_file(item)
                if is_allowed:
                    file_info = get_file_info(item_path)
                    
                    # Only generate thumbnails for images and videos
                    thumbnail_filename = None
                    if detected_type in ['image', 'video']:
                        thumbnail_filename = f"{hashlib.md5(item_path.encode()).hexdigest()}.jpg"
                        thumbnail_path = os.path.join(app.static_folder, 'thumbnails', thumbnail_filename)
                        if not os.path.exists(thumbnail_path):
                            generate_thumbnail(item_path, detected_type, thumbnail_path)
                    
                    media_files.append({
                        'filename': item,
                        'relative_path': relative_path,
                        'folder': folder_path,
                        'type': detected_type,
                        'size': file_info['size'],
                        'modified': file_info['modified'],
                        'thumbnail': thumbnail_filename if thumbnail_filename and os.path.exists(os.path.join(app.static_folder, 'thumbnails', thumbnail_filename)) else None,
                        'full_path': item_path
                    })
            elif os.path.isdir(item_path):
                subfolder_files = scan_media_files(base_path, relative_path)
                media_files.extend(subfolder_files)
    except (OSError, PermissionError):
        pass
    
    return media_files

def generate_enhanced_video_thumbnail(file_path, thumbnail_path, timestamp='00:00:05.000'):
    """Generate better video thumbnails with multiple timestamp attempts"""
    try:
        timestamps = [timestamp, '00:00:01.000', '00:00:10.000', '00:00:30.000']
        
        for ts in timestamps:
            cmd = [
                'ffmpeg', '-i', file_path, '-ss', ts,
                '-vframes', '1', 
                '-vf', f'scale={Config.THUMBNAIL_SIZE[0]}:{Config.THUMBNAIL_SIZE[1]}:force_original_aspect_ratio=decrease,pad={Config.THUMBNAIL_SIZE[0]}:{Config.THUMBNAIL_SIZE[1]}:(ow-iw)/2:(oh-ih)/2',
                '-q:v', '2',
                '-y', thumbnail_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode == 0 and os.path.exists(thumbnail_path) and os.path.getsize(thumbnail_path) > 0:
                return True
        
        return False
    except Exception as e:
        print(f"Error generating video thumbnail: {e}")
        return False

def generate_thumbnail(file_path, file_type, thumbnail_path):
    """Generate thumbnail for media files"""
    try:
        if file_type == 'image':
            with Image.open(file_path) as img:
                img = ImageOps.exif_transpose(img)
                img.thumbnail(Config.THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
                img.save(thumbnail_path, 'JPEG', quality=85)
                return True
        elif file_type == 'video':
            return generate_enhanced_video_thumbnail(file_path, thumbnail_path)
    except Exception as e:
        print(f"Error generating thumbnail: {e}")
    return False

def refresh_jellyfin_library():
    """Trigger Jellyfin library refresh"""
    if not Config.JELLYFIN_API_KEY:
        return False
    
    try:
        headers = {'X-Emby-Token': Config.JELLYFIN_API_KEY}
        response = requests.post(
            f"{Config.JELLYFIN_URL}/Library/Refresh",
            headers=headers,
            timeout=10
        )
        return response.status_code == 204
    except Exception as e:
        print(f"Error refreshing Jellyfin library: {e}")
        return False

def format_file_size(size_bytes):
    """Format file size in human readable format"""
    if size_bytes == 0:
        return "0 B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    
    return f"{size_bytes:.1f} {size_names[i]}"

def get_file_info(file_path):
    """Get file information"""
    stat = os.stat(file_path)
    return {
        'size': stat.st_size,
        'modified': datetime.fromtimestamp(stat.st_mtime),
        'created': datetime.fromtimestamp(stat.st_ctime)
    }

def validate_file_size(file_path, file_type):
    """Validate file size based on type"""
    try:
        file_size = os.path.getsize(file_path)
        max_size = Config.FILE_SIZE_LIMITS.get(file_type, Config.MAX_CONTENT_LENGTH)
        
        if file_size > max_size:
            return False, f"File too large. Maximum size for {file_type} files is {format_file_size(max_size)}"
        return True, None
    except Exception as e:
        return False, f"Error checking file size: {str(e)}"

def chunked_file_save(file_obj, file_path, chunk_size=8192):
    """Save large files in chunks to handle memory efficiently"""
    try:
        with open(file_path, 'wb') as f:
            while True:
                chunk = file_obj.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
        return True, None
    except Exception as e:
        return False, str(e)

def generate_streaming_token(filename, user_id):
    """Generate a temporary token for external player streaming"""
    token = secrets.token_urlsafe(32)
    expiry = time.time() + Config.STREAM_TOKEN_EXPIRY
    
    streaming_tokens[token] = {
        'filename': filename,
        'user_id': user_id,
        'expires': expiry,
        'created': time.time()
    }
    
    # Clean up expired tokens
    cleanup_expired_tokens()
    
    return token

def cleanup_expired_tokens():
    """Remove expired streaming tokens"""
    current_time = time.time()
    expired_tokens = [token for token, data in streaming_tokens.items() 
                     if data['expires'] < current_time]
    
    for token in expired_tokens:
        del streaming_tokens[token]

def validate_streaming_token(token, filename):
    """Validate a streaming token"""
    if token not in streaming_tokens:
        return False
    
    token_data = streaming_tokens[token]
    current_time = time.time()
    
    # Check if token is expired
    if token_data['expires'] < current_time:
        del streaming_tokens[token]
        return False
    
    # Check if filename matches
    if token_data['filename'] != filename:
        return False
    
    return True

def count_nested_folders(base_path):
    """Count total number of folders including nested ones"""
    count = 0
    if not os.path.exists(base_path):
        return count
    
    try:
        for root, dirs, files in os.walk(base_path):
            count += len(dirs)
    except (OSError, PermissionError):
        pass
    
    return count

def natural_sort_key(text: str) -> List:
    """
    Generate a key for natural sorting that handles numbers properly
    """
    def convert(text_part):
        if text_part.isdigit():
            return int(text_part)
        return text_part.lower()
    
    return [convert(c) for c in re.split('([0-9]+)', text)]

def extract_episode_info(filename: str) -> Dict[str, Any]:
    """
    Extract season, episode, and series information from filename
    """
    # Remove file extension
    clean_name = re.sub(r'\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v)$', '', filename, flags=re.IGNORECASE)
    
    episode_info = {
        'original_filename': filename,
        'clean_title': clean_name,
        'season': None,
        'episode': None,
        'series_name': None
    }
    
    # Common episode patterns
    patterns = [
        (r'(.+?)\s+[Ss](\d+)[Ee](\d+)', 'series_season_episode'),     # Series S01E01
        (r'(.+?)\s+[Ss]eason\s*(\d+).*?[Ee]pisode\s*(\d+)', 'series_season_episode'),  # Series Season 1 Episode 1
        (r'(.+?)\s+(\d+)x(\d+)', 'series_season_episode'),            # Series 1x01
        (r'(.+?)\s+[Ee]p\.?\s*(\d+)', 'series_episode'),              # Series Ep01
        (r'(.+?)\s+[Ee]pisode\s*(\d+)', 'series_episode'),            # Series Episode 01
        (r'(.+?)\s+[Ee](\d+)', 'series_episode'),                     # Series E01
        (r'(.+?)\s+(\d+)', 'series_episode'),                         # Series 01
    ]
    
    for pattern, pattern_type in patterns:
        match = re.search(pattern, clean_name, re.IGNORECASE)
        if match:
            if pattern_type == 'series_season_episode':
                episode_info['series_name'] = match.group(1).strip()
                episode_info['season'] = int(match.group(2))
                episode_info['episode'] = int(match.group(3))
            elif pattern_type == 'series_episode':
                episode_info['series_name'] = match.group(1).strip()
                episode_info['episode'] = int(match.group(2))
            break
    
    # If no pattern matched, try to extract series name and episode from the structure
    if not episode_info['series_name']:
        # Look for numbers at the end
        numbers = re.findall(r'\d+', clean_name)
        if numbers:
            episode_info['episode'] = int(numbers[-1])
            # Remove the number to get series name
            series_match = re.sub(r'\s*\d+\s*$', '', clean_name)
            if series_match:
                episode_info['series_name'] = series_match.strip()
    
    return episode_info

def group_files_by_series(files: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Group video files by series with proper episode ordering
    """
    series_groups = {}
    
    for file_data in files:
        if file_data.get('type') != 'video':
            continue
        
        episode_info = extract_episode_info(file_data['filename'])
        
        # Determine series key (prefer folder structure, then extracted series name)
        series_key = (
            file_data.get('folder', '').strip() or 
            episode_info.get('series_name', '').strip() or 
            'Unknown Series'
        )
        
        # Normalize series key
        series_key = series_key.replace('/', ' ').strip()
        if not series_key:
            series_key = 'Unknown Series'
        
        if series_key not in series_groups:
            series_groups[series_key] = []
        
        # Add episode info to file data
        enhanced_file = {**file_data, **episode_info, 'series_key': series_key}
        series_groups[series_key].append(enhanced_file)
    
    # Sort each series by season and episode
    for series_key in series_groups:
        series_groups[series_key].sort(key=lambda x: (
            x.get('season') or 0,  # Sort by season first
            x.get('episode') or 0,  # Then by episode
            natural_sort_key(x['filename'])  # Finally by filename naturally
        ))
    
    return series_groups

def get_enhanced_media_files(base_path: str, folder_path: str = '') -> List[Dict[str, Any]]:
    """
    Enhanced version of scan_media_files with episode information
    """
    media_files = scan_media_files(base_path, folder_path)
    
    # Add episode information to video files
    for file_data in media_files:
        if file_data.get('type') == 'video':
            episode_info = extract_episode_info(file_data['filename'])
            file_data.update(episode_info)
    
    # Sort files naturally
    media_files.sort(key=lambda x: natural_sort_key(x['filename']))
    
    return media_files

def find_next_episode(current_file: Dict[str, Any], all_files: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Find the next episode in sequence for a given file
    """
    if current_file.get('type') != 'video':
        return None
    
    series_groups = group_files_by_series(all_files)
    current_series_key = current_file.get('series_key')
    
    if not current_series_key or current_series_key not in series_groups:
        return None
    
    series_episodes = series_groups[current_series_key]
    current_index = -1
    
    # Find current episode index
    for i, episode in enumerate(series_episodes):
        if episode['filename'] == current_file['filename']:
            current_index = i
            break
    
    # Return next episode if exists
    if current_index >= 0 and current_index < len(series_episodes) - 1:
        return series_episodes[current_index + 1]
    
    return None

def find_previous_episode(current_file: Dict[str, Any], all_files: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Find the previous episode in sequence for a given file
    """
    if current_file.get('type') != 'video':
        return None
    
    series_groups = group_files_by_series(all_files)
    current_series_key = current_file.get('series_key')
    
    if not current_series_key or current_series_key not in series_groups:
        return None
    
    series_episodes = series_groups[current_series_key]
    current_index = -1
    
    # Find current episode index
    for i, episode in enumerate(series_episodes):
        if episode['filename'] == current_file['filename']:
            current_index = i
            break
    
    # Return previous episode if exists
    if current_index > 0:
        return series_episodes[current_index - 1]
    
    return None

# New API endpoints for episode navigation
@app.route('/api/episode/next/<path:filename>')
@login_required
def api_next_episode(filename):
    """Get next episode in sequence"""
    try:
        # Find the file across all media directories
        current_file = None
        all_files = []
        
        for file_type in ['video']:  # Only check video files for episodes
            media_dir = get_media_path(file_type)
            files = get_enhanced_media_files(media_dir)
            all_files.extend(files)
            
            # Find current file
            for file_data in files:
                if file_data['relative_path'] == filename:
                    current_file = file_data
                    break
        
        if not current_file:
            return jsonify({'error': 'File not found'}), 404
        
        next_episode = find_next_episode(current_file, all_files)
        
        if next_episode:
            return jsonify({
                'success': True,
                'next_episode': {
                    'filename': next_episode['filename'],
                    'relative_path': next_episode['relative_path'],
                    'title': next_episode.get('clean_title', next_episode['filename']),
                    'season': next_episode.get('season'),
                    'episode': next_episode.get('episode'),
                    'series_name': next_episode.get('series_name'),
                    'stream_url': url_for('stream_file', filename=next_episode['relative_path'])
                }
            })
        else:
            return jsonify({'success': False, 'message': 'No next episode found'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/episode/previous/<path:filename>')
@login_required
def api_previous_episode(filename):
    """Get previous episode in sequence"""
    try:
        # Find the file across all media directories
        current_file = None
        all_files = []
        
        for file_type in ['video']:
            media_dir = get_media_path(file_type)
            files = get_enhanced_media_files(media_dir)
            all_files.extend(files)
            
            # Find current file
            for file_data in files:
                if file_data['relative_path'] == filename:
                    current_file = file_data
                    break
        
        if not current_file:
            return jsonify({'error': 'File not found'}), 404
        
        previous_episode = find_previous_episode(current_file, all_files)
        
        if previous_episode:
            return jsonify({
                'success': True,
                'previous_episode': {
                    'filename': previous_episode['filename'],
                    'relative_path': previous_episode['relative_path'],
                    'title': previous_episode.get('clean_title', previous_episode['filename']),
                    'season': previous_episode.get('season'),
                    'episode': previous_episode.get('episode'),
                    'series_name': previous_episode.get('series_name'),
                    'stream_url': url_for('stream_file', filename=previous_episode['relative_path'])
                }
            })
        else:
            return jsonify({'success': False, 'message': 'No previous episode found'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/series/<path:filename>')
@login_required
def api_series_episodes(filename):
    """Get all episodes in the same series"""
    try:
        # Find the file and its series
        current_file = None
        all_files = []
        
        for file_type in ['video']:
            media_dir = get_media_path(file_type)
            files = get_enhanced_media_files(media_dir)
            all_files.extend(files)
            
            # Find current file
            for file_data in files:
                if file_data['relative_path'] == filename:
                    current_file = file_data
                    break
        
        if not current_file:
            return jsonify({'error': 'File not found'}), 404
        
        series_groups = group_files_by_series(all_files)
        current_series_key = current_file.get('series_key')
        
        if current_series_key and current_series_key in series_groups:
            episodes = series_groups[current_series_key]
            return jsonify({
                'success': True,
                'series_name': current_series_key,
                'episodes': [
                    {
                        'filename': ep['filename'],
                        'relative_path': ep['relative_path'],
                        'title': ep.get('clean_title', ep['filename']),
                        'season': ep.get('season'),
                        'episode': ep.get('episode'),
                        'is_current': ep['relative_path'] == filename,
                        'stream_url': url_for('stream_file', filename=ep['relative_path'])
                    }
                    for ep in episodes
                ]
            })
        else:
            return jsonify({'success': False, 'message': 'No series found'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
    
# Enhanced streaming with range support
def stream_file_with_ranges(file_path, video_info=None):
    """Stream file with HTTP range support for better video playback"""
    try:
        size = os.path.getsize(file_path)
        byte_start = 0
        byte_end = size - 1
        
        # Parse Range header
        range_header = request.headers.get('Range', None)
        if range_header:
            match = re.search(r'bytes=(\d+)-(\d*)', range_header)
            if match:
                byte_start = int(match.group(1))
                if match.group(2):
                    byte_end = int(match.group(2))
        
        byte_end = min(byte_end, size - 1)
        content_length = byte_end - byte_start + 1
        
        # Enhanced content type detection
        content_type = 'application/octet-stream'
        ext = os.path.splitext(file_path)[1].lower()
        
        if file_path.endswith('.mp4'):
            content_type = 'video/mp4'
        elif file_path.endswith('.webm'):
            content_type = 'video/webm'
        elif file_path.endswith('.mkv'):
            content_type = 'video/x-matroska'
        elif file_path.endswith('.avi'):
            content_type = 'video/x-msvideo'
        else:
            # Fallback to mimetypes
            detected_type = mimetypes.guess_type(file_path)[0]
            if detected_type:
                content_type = detected_type
        
        # Document types
        if ext in ['.pdf']:
            content_type = 'application/pdf'
        elif ext in ['.doc', '.docx']:
            content_type = 'application/msword'
        elif ext in ['.xls', '.xlsx']:
            content_type = 'application/vnd.ms-excel'
        elif ext in ['.ppt', '.pptx']:
            content_type = 'application/vnd.ms-powerpoint'
        elif ext in ['.txt', '.md', '.csv']:
            content_type = 'text/plain'
        elif ext in ['.rtf']:
            content_type = 'application/rtf'
        elif ext in ['.odt']:
            content_type = 'application/vnd.oasis.opendocument.text'
        elif ext in ['.ods']:
            content_type = 'application/vnd.oasis.opendocument.spreadsheet'
        elif ext in ['.odp']:
            content_type = 'application/vnd.oasis.opendocument.presentation'
            
        # Code types
        elif ext in ['.js']:
            content_type = 'application/javascript'
        elif ext in ['.json']:
            content_type = 'application/json'
        elif ext in ['.xml']:
            content_type = 'application/xml'
        elif ext in ['.yaml', '.yml']:
            content_type = 'application/x-yaml'
        elif ext in ['.html', '.htm']:
            content_type = 'text/html'
        elif ext in ['.css']:
            content_type = 'text/css'
        elif ext in ['.py', '.sh', '.php', '.java', '.cpp', '.h', '.sql']:
            content_type = 'text/plain'
            
        # Archive types
        elif ext in ['.zip']:
            content_type = 'application/zip'
        elif ext in ['.rar']:
            content_type = 'application/x-rar-compressed'
        elif ext in ['.7z']:
            content_type = 'application/x-7z-compressed'
        elif ext in ['.tar']:
            content_type = 'application/x-tar'
        elif ext in ['.gz']:
            content_type = 'application/gzip'
        elif ext in ['.bz2']:
            content_type = 'application/x-bzip2'
        elif ext in ['.xz']:
            content_type = 'application/x-xz'
            
                        
        def generate():
            with open(file_path, 'rb') as f:
                f.seek(byte_start)
                remaining = content_length
                while remaining > 0:
                    chunk_size = min(Config.CHUNK_SIZE, remaining)
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk
        
        # Build response headers with enhanced video support
        headers = {
            'Content-Type': content_type,
            'Accept-Ranges': 'bytes',
            'Content-Length': str(content_length),
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
        
        # Add range headers if this is a range request
        if range_header:
            headers['Content-Range'] = f'bytes {byte_start}-{byte_end}/{size}'
            status_code = 206
        else:
            status_code = 200
        
        # Add video-specific headers for better browser compatibility
        if 'video' in content_type:
            headers.update({
                'X-Content-Duration': str(video_info.get('duration', 0)) if video_info else '0',
                'Content-Disposition': 'inline',
            })
        
        print(f"Streaming {file_path} ({content_type}) - Range: {byte_start}-{byte_end}/{size}")
        
        response = Response(generate(), status_code, headers=headers)
        return response
        
    except Exception as e:
        print(f"Error streaming file {file_path}: {e}")
        abort(500)

# Routes (keeping all original routes)
@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('gallery'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username') or request.json.get('username')
        password = request.form.get('password') or request.json.get('password')
        
        print(f"Login attempt for user: {username}")
        print(f"Request IP: {request.remote_addr}")
        print(f"Content-Type: {request.headers.get('Content-Type')}")
        print(f"Origin: {request.headers.get('Origin', 'No Origin')}")
        
        user = user_manager.verify_password(username, password)
        if user:
            # Clear any existing session data
            session.clear()
            
            # Login the user with remember=True for persistent sessions
            login_user(user, remember=True)
            
            # Make session permanent
            session.permanent = True
            
            # Store additional session data
            session['user_id'] = user.id
            session['username'] = user.username
            session['is_admin'] = user.is_admin
            
            print(f"Login successful for {username}")
            print(f"Session ID: {session.get('_id', 'No session ID')}")
            
            # Handle API requests (React frontend)
            if (request.headers.get('Content-Type') == 'application/json' or 
                request.headers.get('Accept') and 'application/json' in request.headers.get('Accept')):
                return jsonify({
                    'success': True,
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'is_admin': user.is_admin
                    }
                }), 200
            
            # Handle form submissions (template-based)
            else:
                next_page = request.args.get('next')
                return redirect(next_page) if next_page else redirect(url_for('gallery'))
        else:
            print(f"Login failed for {username} - invalid credentials")
            
            # Handle API requests
            if (request.headers.get('Content-Type') == 'application/json' or 
                request.headers.get('Accept') and 'application/json' in request.headers.get('Accept')):
                return jsonify({
                    'success': False,
                    'error': 'Invalid username or password'
                }), 401
            
            # Handle template requests
            else:
                flash('Invalid username or password')
    
    # Always render template for GET requests
    return render_template('login.html')

@app.route('/api/login', methods=['POST'])
def api_login():
    """API-only login endpoint for React frontend"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    print(f"API Login attempt for user: {username}")
    print(f"Request IP: {request.remote_addr}")
    print(f"Origin: {request.headers.get('Origin', 'No Origin')}")
    
    user = user_manager.verify_password(username, password)
    if user:
        # Clear any existing session data
        session.clear()
        
        # Login the user
        login_user(user, remember=True)
        session.permanent = True
        
        # Store session data
        session['user_id'] = user.id
        session['username'] = user.username
        session['is_admin'] = user.is_admin
        
        print(f"API Login successful for {username}")
        print(f"Session data: {dict(session)}")
        
        return jsonify({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'is_admin': user.is_admin
            }
        }), 200
    else:
        print(f"API Login failed for {username}")
        return jsonify({
            'success': False,
            'error': 'Invalid username or password'
        }), 401



@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        
        if password != confirm_password:
            flash('Passwords do not match')
        elif user_manager.get_user_by_username(username):
            flash('Username already exists')
        elif len(password) < 6:
            flash('Password must be at least 6 characters long')
        else:
            user_manager.create_user(username, password)
            flash('Registration successful! Please log in.')
            return redirect(url_for('login'))
    return render_template('register.html')


@app.route('/logout')
@login_required
def logout():
    print(f"Logout for user: {current_user.username if current_user.is_authenticated else 'Unknown'}")
    
    # Clear session data
    session.clear()
    
    # Logout user
    logout_user()
    
    return redirect(url_for('login'))

# Add a middleware to help debug session issues
@app.before_request
def before_request():
    """Debug session information on each request"""
    if app.debug:  # Only in debug mode
        print(f"\n--- Request Debug Info ---")
        print(f"Path: {request.path}")
        print(f"Method: {request.method}")
        print(f"IP: {request.remote_addr}")
        print(f"Session ID: {session.get('_id', 'No session')}")
        print(f"User authenticated: {current_user.is_authenticated}")
        if current_user.is_authenticated:
            print(f"Current user: {current_user.username}")
        print(f"Session data: {dict(session)}")
        print("--- End Debug Info ---\n")

@app.route('/upload', methods=['GET', 'POST'])
@login_required
def upload():
    if request.method == 'POST':
        if 'files' not in request.files:
            flash('No file selected')
            return redirect(request.url)
        
        files = request.files.getlist('files')
        custom_folder = request.form.get('custom_folder', '').strip()
        file_type_filter = request.form.get('file_type', '')
        
        if custom_folder:
            custom_folder = sanitize_folder_path(custom_folder)
            if not custom_folder:
                flash('Invalid folder path')
                return redirect(request.url)
        
        uploaded_files = []
        errors = []
        
        for file in files:
            if file.filename == '':
                continue
            
            is_allowed, file_type = allowed_file(file.filename)
            if not is_allowed:
                errors.append(f'File type not allowed: {file.filename}')
                continue
            
            if file_type_filter and file_type != file_type_filter:
                errors.append(f'File {file.filename} does not match selected type filter ({file_type_filter})')
                continue
            
            filename = secure_filename(file.filename)
            if not filename:
                continue
            
            media_dir = get_media_path(file_type)
            
            if custom_folder:
                media_dir = os.path.join(media_dir, custom_folder)
            
            ensure_directory(media_dir)
            
            thumbnails_dir = os.path.join(app.static_folder, 'thumbnails')
            ensure_directory(thumbnails_dir)
            
            file_path = os.path.join(media_dir, filename)
            if os.path.exists(file_path):
                name, ext = os.path.splitext(filename)
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"{name}_{timestamp}{ext}"
                file_path = os.path.join(media_dir, filename)
            
            try:
                file_size = 0
                if hasattr(file, 'content_length') and file.content_length:
                    file_size = file.content_length
                
                max_size = Config.FILE_SIZE_LIMITS.get(file_type, Config.MAX_CONTENT_LENGTH)
                if file_size > max_size:
                    errors.append(f'File {filename} is too large. Maximum size for {file_type} files is {format_file_size(max_size)}')
                    continue
                
                if file_size > 100 * 1024 * 1024:
                    success, error = chunked_file_save(file, file_path)
                    if not success:
                        errors.append(f'Failed to save {filename}: {error}')
                        continue
                else:
                    file.save(file_path)
                
                is_valid, error_msg = validate_file_size(file_path, file_type)
                if not is_valid:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    errors.append(f'{filename}: {error_msg}')
                    continue
                
                thumbnail_filename = f"{hashlib.md5(file_path.encode()).hexdigest()}.jpg"
                thumbnail_path = os.path.join(thumbnails_dir, thumbnail_filename)
                
                if file_type in ['image', 'video']:
                    generate_thumbnail(file_path, file_type, thumbnail_path)
                
                uploaded_files.append({
                    'filename': filename,
                    'type': file_type,
                    'folder': custom_folder or 'Root',
                    'path': file_path,
                    'size': os.path.getsize(file_path),
                    'thumbnail': thumbnail_filename if os.path.exists(thumbnail_path) else None
                })
                
            except Exception as e:
                errors.append(f'Error uploading {filename}: {str(e)}')
                if os.path.exists(file_path):
                    os.remove(file_path)
        
        if uploaded_files:
            flash(f'Successfully uploaded {len(uploaded_files)} file(s)')
            for uploaded_file in uploaded_files:
                if uploaded_file['size'] > 100 * 1024 * 1024:
                    flash(f"✓ {uploaded_file['filename']} ({format_file_size(uploaded_file['size'])})")
            
            if refresh_jellyfin_library():
                flash('Jellyfin library refresh triggered')
        
        if errors:
            for error in errors:
                flash(f'Error: {error}', 'error')
        
        return redirect(url_for('gallery'))
    
    folder_structure = {}
    for file_type in ['image', 'video', 'audio']:
        media_dir = get_media_path(file_type)
        folder_structure[file_type] = get_all_folder_paths(media_dir)
    
    return render_template('upload.html', 
                         folder_structure=folder_structure,
                         file_size_limits=Config.FILE_SIZE_LIMITS,
                         format_file_size=format_file_size)

@app.route('/gallery')
@login_required
def gallery():
    folder_filter = request.args.get('folder', '')
    file_type_filter = request.args.get('type', '')
    sort_by = request.args.get('sort', 'name')
    
    media_files = []
    folder_structure = {}
    
    for file_type in ['image', 'video', 'audio']:
        media_dir = get_media_path(file_type)
        folder_structure[file_type] = get_nested_folder_structure(media_dir)
        
        if file_type_filter and file_type != file_type_filter:
            continue
        
        if folder_filter:
            files_in_folder = scan_media_files(media_dir, folder_filter)
            media_files.extend(files_in_folder)
        else:
            files_in_dir = scan_media_files(media_dir)
            media_files.extend(files_in_dir)
    
    # Sort files
    if sort_by == 'size':
        media_files.sort(key=lambda x: x['size'], reverse=True)
    elif sort_by == 'date':
        media_files.sort(key=lambda x: x['modified'], reverse=True)
    elif sort_by == 'folder':
        media_files.sort(key=lambda x: (x['folder'], x['filename'].lower()))
    else:  # name
        media_files.sort(key=lambda x: x['filename'].lower())
    
    return render_template('gallery.html', 
                         files=media_files, 
                         folder_structure=folder_structure,
                         current_folder=folder_filter,
                         current_type=file_type_filter,
                         sort_by=sort_by)

@app.route('/create_folder', methods=['POST'])
@login_required
def create_folder():
    """Create a new folder in media directory"""
    folder_path = request.form.get('folder_path', '').strip()
    file_type = request.form.get('file_type', '')
    
    if not folder_path or not file_type:
        flash('Folder path and file type are required')
        return redirect(url_for('gallery'))
    
    folder_path = sanitize_folder_path(folder_path)
    if not folder_path:
        flash('Invalid folder path')
        return redirect(url_for('gallery'))
    
    media_dir = get_media_path(file_type)
    full_folder_path = os.path.join(media_dir, folder_path)
    
    if os.path.exists(full_folder_path):
        flash(f'Folder "{folder_path}" already exists')
    else:
        try:
            ensure_directory(full_folder_path)
            flash(f'Folder "{folder_path}" created successfully')
        except Exception as e:
            flash(f'Error creating folder: {str(e)}')
    
    return redirect(url_for('gallery'))

@app.route('/stream/<path:filename>')
@login_required
def stream_file(filename):
    """Enhanced streaming for all media files"""
    # Find file in media directories (including nested subfolders)
    file_path = None
    file_type = None
    
    for ftype in ['image', 'video', 'audio']:
        media_dir = get_media_path(ftype)
        potential_path = os.path.join(media_dir, filename)
        potential_path = os.path.normpath(potential_path)
        
        if os.path.exists(potential_path) and os.path.isfile(potential_path):
            file_path = potential_path
            file_type = ftype
            break
    
    if not file_path:
        abort(404)
    
    # For video files, get video info for better streaming
    video_info = None
    if file_type == 'video':
        video_info = get_video_info(file_path)
    
    # Check if this is a request from an external player (based on User-Agent or lack of cookies)
    user_agent = request.headers.get('User-Agent', '').lower()
    is_external_player = any(player in user_agent for player in ['mpv', 'vlc', 'mpc-hc', 'iina']) or \
                       'range' in request.headers.get('Accept-Encoding', '').lower() or \
                       not request.cookies.get('session')
    
    # For external players, we might need to bypass login check in some cases
    # But for security, we'll keep the login requirement and suggest token-based auth if needed
    
    # Use range streaming for all files
    range_header = request.headers.get('Range', None)
    if not range_header and file_type != 'video':
        return send_file(file_path)
    
    return stream_file_with_ranges(file_path, video_info)

@app.route('/thumbnail/<filename>')
def thumbnail(filename):
    """Serve thumbnails"""
    thumbnail_path = os.path.join(app.static_folder, 'thumbnails', filename)
    if os.path.exists(thumbnail_path):
        return send_file(thumbnail_path)
    abort(404)

@app.route('/api/folder-thumbnail', methods=['POST'])
@login_required
def api_upload_folder_thumbnail():
    """Upload custom thumbnail for a folder"""
    if 'thumbnail' not in request.files:
        return jsonify({'error': 'No thumbnail file provided'}), 400
    
    file = request.files['thumbnail']
    folder_path = request.form.get('folder_path', 'Root')
    file_type = request.form.get('file_type', 'image')
    inherit_to_children = request.form.get('inherit_to_children', 'false').lower() == 'true'
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Validate image file
    if not file.content_type.startswith('image/'):
        return jsonify({'error': 'File must be an image'}), 400
    
    try:
        # Create unique filename for folder thumbnail
        folder_key = f"{file_type}_{folder_path}".replace('/', '_').replace('\\', '_')
        timestamp = int(time.time())
        thumbnail_filename = f"folder_{folder_key}_{timestamp}.jpg"
        thumbnail_path = os.path.join(app.static_folder, 'thumbnails', thumbnail_filename)
        
        # Resize and save thumbnail
        with Image.open(file.stream) as img:
            img = ImageOps.exif_transpose(img)
            img.thumbnail(Config.THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
            img.save(thumbnail_path, 'JPEG', quality=85)
        
        # Update folder thumbnails registry
        folder_thumbnails = load_folder_thumbnails()
        folder_key = f"{file_type}/{folder_path}"
        
        # Remove old thumbnail file if exists
        if folder_key in folder_thumbnails:
            old_data = folder_thumbnails[folder_key]
            old_filename = old_data.get('thumbnail_filename') if isinstance(old_data, dict) else old_data
            if old_filename and old_filename.startswith('folder_'):
                old_path = os.path.join(app.static_folder, 'thumbnails', old_filename)
                if os.path.exists(old_path):
                    os.remove(old_path)
        
        # Store new thumbnail data
        folder_thumbnails[folder_key] = {
            'thumbnail_filename': thumbnail_filename,
            'thumbnail_url': url_for('thumbnail', filename=thumbnail_filename),
            'inherit_to_children': inherit_to_children,
            'uploaded_at': datetime.now().isoformat()
        }
        
        if save_folder_thumbnails(folder_thumbnails):
            return jsonify({
                'message': 'Folder thumbnail uploaded successfully',
                'thumbnail_url': url_for('thumbnail', filename=thumbnail_filename),
                'folder_path': folder_path,
                'inherit_to_children': inherit_to_children
            })
        else:
            return jsonify({'error': 'Failed to save thumbnail data'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Failed to process thumbnail: {str(e)}'}), 500

@app.route('/api/folder-thumbnail', methods=['DELETE'])
@login_required
def api_delete_folder_thumbnail():
    """Delete custom thumbnail for a folder"""
    data = request.get_json()
    folder_path = data.get('folder_path', 'Root')
    file_type = data.get('file_type', 'image')
    
    folder_thumbnails = load_folder_thumbnails()
    folder_key = f"{file_type}/{folder_path}"
    
    if folder_key in folder_thumbnails:
        # Remove thumbnail file
        old_data = folder_thumbnails[folder_key]
        old_filename = old_data.get('thumbnail_filename') if isinstance(old_data, dict) else old_data
        if old_filename and old_filename.startswith('folder_'):
            old_path = os.path.join(app.static_folder, 'thumbnails', old_filename)
            if os.path.exists(old_path):
                os.remove(old_path)
        
        # Remove from registry
        del folder_thumbnails[folder_key]
        
        if save_folder_thumbnails(folder_thumbnails):
            return jsonify({'message': 'Folder thumbnail removed successfully'})
        else:
            return jsonify({'error': 'Failed to update thumbnail data'}), 500
    else:
        return jsonify({'error': 'No custom thumbnail found for this folder'}), 404

@app.route('/api/folder-thumbnail/<file_type>/<path:folder_path>')
@login_required
def api_get_folder_thumbnail(file_type, folder_path):
    """Get thumbnail URL for a folder"""
    thumbnail_url = get_folder_thumbnail(folder_path, file_type)
    
    if thumbnail_url:
        if thumbnail_url.startswith('http'):
            return jsonify({'thumbnail_url': thumbnail_url})
        else:
            return jsonify({'thumbnail_url': url_for('thumbnail', filename=thumbnail_url)})
    else:
        return jsonify({'thumbnail_url': None})

# Modify existing scan_media_files function to include folder thumbnails
def scan_media_files_enhanced(base_path, folder_path='', file_type=None):
    """Enhanced version that includes folder thumbnail information"""
    media_files = scan_media_files(base_path, folder_path)  # Use existing function
    
    # Add folder thumbnail information to each file
    for file_data in media_files:
        file_folder = file_data.get('folder', 'Root')
        detected_type = file_data.get('type')
        
        # Get folder thumbnail (with inheritance)
        folder_thumbnail = get_folder_thumbnail(file_folder, detected_type)
        file_data['folder_thumbnail'] = folder_thumbnail
    
    return media_files

@app.route('/admin')
@login_required
def admin():
    """Admin panel"""
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('gallery'))
    
    # Get system stats
    stats = {
        'total_users': len(user_manager.users),
        'total_files': 0,
        'total_size': 0,
        'folders': {'image': 0, 'video': 0, 'audio': 0}
    }
    
    for file_type in ['image', 'video', 'audio']:
        media_dir = get_media_path(file_type)
        if os.path.exists(media_dir):
            stats['folders'][file_type] = count_nested_folders(media_dir)
            
            files = scan_media_files(media_dir)
            stats['total_files'] += len(files)
            stats['total_size'] += sum(f['size'] for f in files)
    
    return render_template('admin.html', stats=stats, format_file_size=format_file_size)

@app.route('/delete/<path:filename>', methods=['POST'])
@login_required
def delete_file(filename):
    """Delete a file"""
    if not current_user.is_admin:
        abort(403)
    
    file_path = None
    for file_type in ['image', 'video', 'audio']:
        media_dir = get_media_path(file_type)
        potential_path = os.path.join(media_dir, filename)
        potential_path = os.path.normpath(potential_path)
        
        if os.path.exists(potential_path) and os.path.isfile(potential_path):
            file_path = potential_path
            break
    
    if file_path:
        try:
            os.remove(file_path)
            
            # Remove thumbnail
            thumbnail_filename = f"{hashlib.md5(file_path.encode()).hexdigest()}.jpg"
            thumbnail_path = os.path.join(app.static_folder, 'thumbnails', thumbnail_filename)
            if os.path.exists(thumbnail_path):
                os.remove(thumbnail_path)
            
            flash(f'File {os.path.basename(filename)} deleted successfully')
            refresh_jellyfin_library()
        except Exception as e:
            flash(f'Error deleting file: {str(e)}')
    else:
        flash(f'File {os.path.basename(filename)} not found')
    
    return redirect(url_for('gallery'))

# Enhanced API Routes for video support
@app.route('/api/video/info/<path:filename>')
@login_required
def api_video_info(filename):
    """Get video information and compatibility status"""
    video_path = None
    media_dir = get_media_path('video')
    potential_path = os.path.join(media_dir, filename)
    potential_path = os.path.normpath(potential_path)
    
    if os.path.exists(potential_path) and os.path.isfile(potential_path):
        video_path = potential_path
    
    if not video_path:
        return jsonify({'error': 'Video not found'}), 404
    
    video_info = get_video_info(video_path)
    if not video_info:
        return jsonify({'error': 'Unable to read video information'}), 500
    
    return jsonify({
        'filename': filename,
        'duration': video_info.get('duration', 0),
        'size': video_info.get('size', 0),
        'video_codec': video_info.get('video_stream', {}).get('codec_name'),
        'audio_codec': video_info.get('audio_stream', {}).get('codec_name'),
        'format': video_info.get('format', {}).get('format_name'),
        'resolution': f"{video_info.get('video_stream', {}).get('width', 0)}x{video_info.get('video_stream', {}).get('height', 0)}",
        'bitrate': video_info.get('format', {}).get('bit_rate'),
        'web_compatible': is_web_compatible(video_info),
        'stream_url': url_for('stream_file', filename=filename)
    })

# Keep all original API routes
@app.route('/api/files')
@login_required
def api_files():
    """REST API endpoint for listing files"""
    folder_filter = request.args.get('folder', '')
    type_filter = request.args.get('type', '')
    
    files = []
    
    for file_type in ['image', 'video', 'audio']:
        if type_filter and file_type != type_filter:
            continue
            
        media_dir = get_media_path(file_type)
        media_files = scan_media_files(media_dir, folder_filter)
        
        for file_data in media_files:
            files.append({
                'filename': file_data['filename'],
                'relative_path': file_data['relative_path'],
                'folder': file_data['folder'],
                'type': file_data['type'],
                'size': file_data['size'],
                'modified': file_data['modified'].isoformat(),
                'url': url_for('stream_file', filename=file_data['relative_path'])
            })
    
    return jsonify(files)

@app.route('/api/session-info')
@login_required
def session_info():
    """Debug endpoint to check session information"""
    return jsonify({
        'session_id': session.get('_id', 'No session ID'),
        'user_id': session.get('user_id', 'No user ID'),
        'session_permanent': session.permanent,
        'logged_in': current_user.is_authenticated,
        'user': {
            'id': current_user.id,
            'username': current_user.username,
            'is_admin': current_user.is_admin
        } if current_user.is_authenticated else None
    })
    
@app.route('/api/folders')
@login_required
def api_folders():
    """REST API endpoint for listing folders"""
    file_type = request.args.get('type', '')
    flat = request.args.get('flat', 'false').lower() == 'true'
    
    if file_type and file_type in ['image', 'video', 'audio']:
        media_dir = get_media_path(file_type)
        if flat:
            folders = get_all_folder_paths(media_dir)
            return jsonify({file_type: folders})
        else:
            folders = get_nested_folder_structure(media_dir)
            return jsonify({file_type: folders})
    else:
        all_folders = {}
        for ftype in ['image', 'video', 'audio']:
            media_dir = get_media_path(ftype)
            if flat:
                all_folders[ftype] = get_all_folder_paths(media_dir)
            else:
                all_folders[ftype] = get_nested_folder_structure(media_dir)
        return jsonify(all_folders)

@app.route('/api/upload', methods=['POST'])
@login_required
def api_upload():
    """REST API endpoint for file upload"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    is_allowed, file_type = allowed_file(file.filename)
    if not is_allowed:
        return jsonify({'error': 'File type not allowed'}), 400
    
    custom_folder = request.form.get('folder', '').strip()
    if custom_folder:
        custom_folder = sanitize_folder_path(custom_folder)
        if not custom_folder:
            return jsonify({'error': 'Invalid folder path'}), 400
    
    filename = secure_filename(file.filename)
    media_dir = get_media_path(file_type)
    
    if custom_folder:
        media_dir = os.path.join(media_dir, custom_folder)
    
    ensure_directory(media_dir)
    
    file_path = os.path.join(media_dir, filename)
    
    if os.path.exists(file_path):
        name, ext = os.path.splitext(filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{name}_{timestamp}{ext}"
        file_path = os.path.join(media_dir, filename)
    
    file.save(file_path)
    
    # Generate thumbnail
    thumbnails_dir = os.path.join(app.static_folder, 'thumbnails')
    ensure_directory(thumbnails_dir)
    thumbnail_filename = f"{hashlib.md5(file_path.encode()).hexdigest()}.jpg"
    thumbnail_path = os.path.join(thumbnails_dir, thumbnail_filename)
    
    if file_type in ['image', 'video']:
        generate_thumbnail(file_path, file_type, thumbnail_path)
    
    refresh_jellyfin_library()
    
    relative_path = os.path.join(custom_folder, filename) if custom_folder else filename
    
    return jsonify({
        'message': 'File uploaded successfully',
        'filename': filename,
        'relative_path': relative_path,
        'folder': custom_folder or 'Root',
        'type': file_type,
        'url': url_for('stream_file', filename=relative_path)
    })

@app.route('/api/delete/<path:filename>', methods=['DELETE'])
@login_required
def api_delete_file(filename):
    """REST API endpoint for file deletion"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    file_path = None
    for file_type in ['image', 'video', 'audio']:
        media_dir = get_media_path(file_type)
        potential_path = os.path.join(media_dir, filename)
        potential_path = os.path.normpath(potential_path)
        
        if os.path.exists(potential_path) and os.path.isfile(potential_path):
            file_path = potential_path
            break
    
    if not file_path:
        return jsonify({'error': 'File not found'}), 404
    
    try:
        os.remove(file_path)
        
        # Remove thumbnail
        thumbnail_filename = f"{hashlib.md5(file_path.encode()).hexdigest()}.jpg"
        thumbnail_path = os.path.join(app.static_folder, 'thumbnails', thumbnail_filename)
        if os.path.exists(thumbnail_path):
            os.remove(thumbnail_path)
        
        refresh_jellyfin_library()
        
        return jsonify({'message': f'File {filename} deleted successfully'})
    except Exception as e:
        return jsonify({'error': f'Failed to delete file: {str(e)}'}), 500

@app.route('/api/move-files', methods=['POST'])
@login_required
def api_move_files():
    """REST API endpoint for moving files"""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'JSON data required'}), 400
    
    file_paths = data.get('file_paths', [])
    destination_folder = data.get('destination_folder', '').strip()
    destination_type = data.get('destination_type', '')
    
    if not file_paths or not destination_type:
        return jsonify({'error': 'File paths and destination type are required'}), 400
    
    if destination_type not in ['image', 'video', 'audio']:
        return jsonify({'error': 'Invalid destination type'}), 400
    
    destination_folder = sanitize_folder_path(destination_folder)
    destination_dir = get_media_path(destination_type)
    
    if destination_folder:
        destination_dir = os.path.join(destination_dir, destination_folder)
    
    ensure_directory(destination_dir)
    
    moved_files = []
    errors = []
    
    for file_path in file_paths:
        try:
            # Find the source file
            source_path = None
            for ftype in ['image', 'video', 'audio']:
                media_dir = get_media_path(ftype)
                potential_path = os.path.join(media_dir, file_path)
                potential_path = os.path.normpath(potential_path)
                
                if os.path.exists(potential_path) and os.path.isfile(potential_path):
                    source_path = potential_path
                    break
            
            if not source_path:
                errors.append(f'File not found: {file_path}')
                continue
            
            # Check if moving to same type
            source_type = None
            for ftype in ['image', 'video', 'audio']:
                media_dir = get_media_path(ftype)
                if source_path.startswith(media_dir):
                    source_type = ftype
                    break
            
            if source_type != destination_type:
                errors.append(f'Cannot move {file_path}: different media types')
                continue
            
            filename = os.path.basename(source_path)
            dest_path = os.path.join(destination_dir, filename)
            
            # Handle filename conflicts
            if os.path.exists(dest_path):
                name, ext = os.path.splitext(filename)
                counter = 1
                while os.path.exists(dest_path):
                    new_filename = f"{name}_{counter}{ext}"
                    dest_path = os.path.join(destination_dir, new_filename)
                    counter += 1
            
            # Move the file
            os.rename(source_path, dest_path)
            moved_files.append(filename)
            
        except Exception as e:
            errors.append(f'Error moving {file_path}: {str(e)}')
    
    if moved_files:
        refresh_jellyfin_library()
    
    return jsonify({
        'message': f'Successfully moved {len(moved_files)} file(s)',
        'moved_files': moved_files,
        'errors': errors
    })

# Admin API Routes (keeping all original ones)
@app.route('/api/admin/refresh-jellyfin', methods=['POST'])
@login_required
def api_refresh_jellyfin():
    """API endpoint to refresh Jellyfin library"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    success = refresh_jellyfin_library()
    if success:
        return jsonify({'success': True, 'message': 'Jellyfin library refresh triggered'})
    else:
        return jsonify({'success': False, 'error': 'Failed to refresh Jellyfin library'})

@app.route('/api/admin/generate-thumbnails', methods=['POST'])
@login_required
def api_generate_thumbnails():
    """API endpoint to regenerate all thumbnails"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    generated_count = 0
    thumbnails_dir = os.path.join(app.static_folder, 'thumbnails')
    ensure_directory(thumbnails_dir)
    
    for file_type in ['image', 'video']:
        media_dir = get_media_path(file_type)
        files = scan_media_files(media_dir)
        
        for file_data in files:
            if file_data['type'] in ['image', 'video']:
                thumbnail_filename = f"{hashlib.md5(file_data['full_path'].encode()).hexdigest()}.jpg"
                thumbnail_path = os.path.join(thumbnails_dir, thumbnail_filename)
                
                if generate_thumbnail(file_data['full_path'], file_data['type'], thumbnail_path):
                    generated_count += 1
    
    return jsonify({'generated': generated_count, 'message': f'Generated {generated_count} thumbnails'})

@app.route('/api/admin/cleanup-thumbnails', methods=['POST'])
@login_required
def api_cleanup_thumbnails():
    """API endpoint to cleanup orphaned thumbnails"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    thumbnails_dir = os.path.join(app.static_folder, 'thumbnails')
    if not os.path.exists(thumbnails_dir):
        return jsonify({'removed': 0, 'message': 'No thumbnails directory found'})
    
    valid_hashes = set()
    for file_type in ['image', 'video', 'audio']:
        media_dir = get_media_path(file_type)
        files = scan_media_files(media_dir)
        
        for file_data in files:
            file_hash = hashlib.md5(file_data['full_path'].encode()).hexdigest()
            valid_hashes.add(f"{file_hash}.jpg")
    
    removed_count = 0
    for thumbnail_file in os.listdir(thumbnails_dir):
        if thumbnail_file not in valid_hashes:
            thumbnail_path = os.path.join(thumbnails_dir, thumbnail_file)
            try:
                os.remove(thumbnail_path)
                removed_count += 1
            except Exception as e:
                print(f"Failed to remove {thumbnail_file}: {e}")
    
    return jsonify({'removed': removed_count, 'message': f'Removed {removed_count} orphaned thumbnails'})

@app.route('/api/admin/stats', methods=['GET'])
@login_required
def api_admin_stats():
    """API endpoint for admin statistics"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    stats = {
        'users': len(user_manager.users),
        'files': {'total': 0, 'by_type': {'image': 0, 'video': 0, 'audio': 0}},
        'storage': {'total_bytes': 0, 'by_type': {'image': 0, 'video': 0, 'audio': 0}},
        'folders': {'image': 0, 'video': 0, 'audio': 0},
        'thumbnails': 0
    }
    
    for file_type in ['image', 'video', 'audio']:
        media_dir = get_media_path(file_type)
        files = scan_media_files(media_dir)
        
        stats['folders'][file_type] = count_nested_folders(media_dir)
        
        for file_data in files:
            stats['files']['total'] += 1
            stats['files']['by_type'][file_data['type']] += 1
            stats['storage']['total_bytes'] += file_data['size']
            stats['storage']['by_type'][file_data['type']] += file_data['size']
    
    # Count thumbnails
    thumbnails_dir = os.path.join(app.static_folder, 'thumbnails')
    if os.path.exists(thumbnails_dir):
        stats['thumbnails'] = len([f for f in os.listdir(thumbnails_dir) if f.endswith('.jpg')])
    
    return jsonify(stats)

@app.route('/api/create-folder', methods=['POST'])
@login_required
def api_create_folder():
    """API endpoint to create a new folder"""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'JSON data required'}), 400
    
    folder_path = data.get('folder_path', '').strip()
    file_type = data.get('file_type', '')
    
    if not folder_path or not file_type:
        return jsonify({'error': 'Folder path and file type are required'}), 400
    
    if file_type not in ['image', 'video', 'audio']:
        return jsonify({'error': 'Invalid file type'}), 400
    
    folder_path = sanitize_folder_path(folder_path)
    if not folder_path:
        return jsonify({'error': 'Invalid folder path'}), 400
    
    media_dir = get_media_path(file_type)
    full_folder_path = os.path.join(media_dir, folder_path)
    
    if os.path.exists(full_folder_path):
        return jsonify({'error': f'Folder "{folder_path}" already exists'}), 409
    
    try:
        ensure_directory(full_folder_path)
        return jsonify({
            'message': f'Folder "{folder_path}" created successfully', 
            'folder_path': folder_path
        })
    except Exception as e:
        return jsonify({'error': f'Error creating folder: {str(e)}'}), 500

# Error handlers
@app.errorhandler(404)
def not_found_error(error):
    return render_template('error.html', error='Page not found'), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('error.html', error='Internal server error'), 500

# Template functions
@app.template_filter('filesize')
def filesize_filter(size):
    """Format file size"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} TB"

def ensure_thumbnail_dir():
    thumbnails_dir = os.path.join(app.static_folder, 'thumbnails')
    if not os.path.exists(thumbnails_dir):
        os.makedirs(thumbnails_dir)
    return thumbnails_dir

if __name__ == '__main__':
    # Ensure required directories exist
    ensure_directory(Config.UPLOAD_FOLDER)
    ensure_directory(os.path.join(app.static_folder, 'thumbnails'))
    ensure_thumbnail_dir()
    # Run the app
    app.run(
        host='0.0.0.0',  # Listen on all interfaces
        port=5000,
        debug=True,
        threaded=True  # Enable threading for better performance
    )