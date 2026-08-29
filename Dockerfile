FROM node:22-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
EXPOSE 3001
VOLUME ["/data"]
CMD ["node", "index.js"]
