# ---- build the web app ----
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime: API server + built static files ----
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
CMD ["node", "server/index.js"]
