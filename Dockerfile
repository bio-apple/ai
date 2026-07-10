FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
ENV PYTHONPATH=/app
ENV HOST=0.0.0.0

EXPOSE 8765
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8765}
