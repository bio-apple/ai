FROM node:22-bookworm AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV ASTRO_TELEMETRY_DISABLED=1
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY --from=frontend /app/dist ./dist
ENV PYTHONPATH=/app
ENV HOST=0.0.0.0
EXPOSE 8765
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8765}
