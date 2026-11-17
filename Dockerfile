FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package*.json ./
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY apps/backend/package.json ./apps/backend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci --no-audit --no-fund
# Vite needs development dependencies, but does not need backend PDF Chromium.
FROM dependencies AS frontend-development
ENV NODE_ENV=development
COPY apps/frontend ./apps/frontend
COPY packages/shared ./packages/shared
RUN chown -R node:node /app
USER node
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace", "@exam/frontend", "--", "--strictPort"]

FROM dependencies AS build
COPY . .
RUN npm run build
FROM dependencies AS production-dependencies
RUN npm prune --omit=dev --no-audit --no-fund
FROM production-dependencies AS frontend
ENV NODE_ENV=production
COPY --from=build /app/apps/frontend/dist ./apps/frontend/dist
COPY apps/frontend/serve.js ./apps/frontend/serve.js
USER node
EXPOSE 5173
CMD ["node", "apps/frontend/serve.js"]
FROM production-dependencies AS backend
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN node node_modules/playwright/cli.js install --with-deps chromium && chmod -R a+rX /ms-playwright
COPY apps/backend ./apps/backend
COPY packages/shared ./packages/shared
COPY apps/frontend/public ./apps/frontend/public
RUN mkdir -p /app/data/assets && chown -R node:node /app/data
USER node
EXPOSE 3001
CMD ["node", "apps/backend/src/index.js"]

FROM backend AS development
USER root
ENV NODE_ENV=development
RUN npm ci --no-audit --no-fund && chown -R node:node /app/node_modules
COPY apps/frontend ./apps/frontend
USER node
