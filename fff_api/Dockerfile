FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency management
RUN pip install uv

# Copy only dependency files first
COPY pyproject.toml uv.lock ./

# Install dependencies using uv
# Using --system to install into the system python, avoiding virtualenv overhead in container
RUN uv pip install --system --require-hashes -r pyproject.toml || uv pip install --system .

# Copy the rest of the application
COPY . .

# Set python path
ENV PYTHONPATH=/app
