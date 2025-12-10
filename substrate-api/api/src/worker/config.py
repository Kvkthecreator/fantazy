"""Worker configuration."""
import os

# Polling configuration
POLL_INTERVAL_SECONDS = int(os.getenv("WORKER_POLL_INTERVAL", "10"))
MAX_CONCURRENT_JOBS = int(os.getenv("WORKER_MAX_CONCURRENT", "3"))

# Job timeouts (seconds)
JOB_TIMEOUT_EMBEDDING = 60
JOB_TIMEOUT_ASSET_ANALYSIS = 120
JOB_TIMEOUT_BATCH_IMPORT = 300

# Retry configuration
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2  # exponential backoff base
