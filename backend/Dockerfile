FROM python:3.11-slim

# Install SUMO and dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    sumo \
    sumo-tools \
    && rm -rf /var/lib/apt/lists/*

# Set SUMO_HOME
ENV SUMO_HOME=/usr/share/sumo

WORKDIR /app

# Install dependencies (context is backend root)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code, configurations, and models
COPY . .

# Set working directory to /app for uvicorn runs
WORKDIR /app

EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]