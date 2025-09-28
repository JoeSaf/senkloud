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

# Copy requirements and install Python dependencies (if file exists)
COPY requirements.txt requirements.txt
RUN if [ -f requirements.txt ]; then \
      pip install --no-cache-dir -r requirements.txt; \
    else \
      echo "No requirements.txt found, skipping dependency install"; \
    fi

# Copy app source files if they exist
COPY . .

# Create placeholder app.py if missing
RUN if [ ! -f app.py ]; then \
      echo "from flask import Flask\napp = Flask(__name__)\n@app.route('/')\ndef index():\n    return 'SenKloud Backend Placeholder'\nif __name__ == '__main__':\n    app.run(host='0.0.0.0', port=5000)" > app.py; \
    fi

# Ensure templates and static exist to avoid runtime errors
RUN mkdir -p templates static /app/data /app/static/thumbnails

# Create a non-root user for security
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app

USER app

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/ || exit 1

CMD ["python", "app.py"]
