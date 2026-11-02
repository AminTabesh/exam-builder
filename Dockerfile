FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npx playwright install --with-deps chromium && chmod -R a+rX /ms-playwright
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY public ./public
RUN mkdir -p /app/data/assets && chown -R node:node /app/data
USER node
EXPOSE 3001
CMD ["node","server/index.js"]
