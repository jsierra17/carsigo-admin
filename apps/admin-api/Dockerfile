# ─────────────────────────────────────────────────────────────
# CarSiGo Admin API → imagen para Cloud Run
# ─────────────────────────────────────────────────────────────
# Build:  gcloud builds submit --tag gcr.io/carsigo-9e508/carsigo-admin-api
# Deploy: gcloud run deploy carsigo-admin-api \
#           --image gcr.io/carsigo-9e508/carsigo-admin-api \
#           --region us-central1 --platform managed --allow-unauthenticated
# ─────────────────────────────────────────────────────────────

FROM node:20-alpine

WORKDIR /app

# Capa de dependencias (se cachea mientras no cambie package.json)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Código fuente
COPY src ./src
COPY scripts ./scripts

# Cloud Run inyecta el puerto por la variable PORT
ENV NODE_ENV=production
ENV PORT=8080

# Cloud Run espera que el servidor escuche en 0.0.0.0:$PORT
EXPOSE 8080

# usuario sin privilegios
USER node

CMD ["node", "src/index.js"]
