# Dockerfile - GRVTBot Custom
FROM node:22-bookworm-slim

WORKDIR /app

# Instala utilidades necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copia package.json
COPY backend/package.json backend/package-lock.json ./

# Instala dependencias
RUN npm ci

# Copia código backend
COPY backend/src ./src
COPY backend/tsconfig.json ./

# Compila TypeScript
RUN npm run build

# Copia frontend compilado (si existe)
COPY frontend/dist ./dist/frontend 2>/dev/null || true

# Crea directorio de datos
RUN mkdir -p /app/data

# Usuario no-root
RUN useradd -m -u 1000 grvtbot && chown -R grvtbot:grvtbot /app
USER grvtbot

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3848/health || exit 1

# Port
EXPOSE 3848

# Start
CMD ["npm", "start"]
