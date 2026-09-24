FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server/realtime ./server/realtime
COPY src/relay-queue.js ./src/relay-queue.js
USER node
EXPOSE 3000
CMD ["node", "server/realtime/index.js"]
