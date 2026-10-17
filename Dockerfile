FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev
COPY client/package*.json client/
RUN npm ci --prefix client
COPY client client
RUN npm run build --prefix client

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data PORT=3001
COPY --from=build /app/node_modules node_modules
COPY package*.json ./
COPY server server
COPY --from=build /app/client/dist client/dist
RUN mkdir -p /data
EXPOSE 3001
CMD ["node", "server/index.js"]
