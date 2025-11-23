# worker/Dockerfile
FROM python:3.10-slim-buster

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Command to run the worker (FastAPI app)
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
