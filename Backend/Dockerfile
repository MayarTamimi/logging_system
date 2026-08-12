FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json drizzle.config.ts ./
COPY src ./src

RUN npm run build

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "dist/server.js"]
