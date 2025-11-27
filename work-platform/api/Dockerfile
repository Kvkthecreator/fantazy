# Direct Anthropic API Deployment
# Simplified Dockerfile after SDK removal - no Node.js required
# First-principled design: Python + direct API calls only

FROM python:3.10-slim

# Install minimal dependencies (curl for health checks, ca-certificates for HTTPS)
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Add /app/src to PYTHONPATH so modules can be imported
ENV PYTHONPATH="/app/src:${PYTHONPATH}"

# Expose port (Render will set PORT env var)
EXPOSE 10000

# Start application
# Use PORT env var from Render, fallback to 10000 for local dev
CMD uvicorn src.app.agent_server:app --host 0.0.0.0 --port ${PORT:-10000} --log-level debug
