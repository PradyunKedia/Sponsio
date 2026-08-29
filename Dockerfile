FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist
EXPOSE 3001
VOLUME ["/data"]
CMD ["node", "index.js"]
