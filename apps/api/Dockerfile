FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @morada/api --ignore-scripts
COPY apps/api apps/api
RUN pnpm --filter @morada/api build

FROM node:22-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
COPY --from=build /repo/apps/api/dist ./dist
EXPOSE 8080
CMD ["node", "dist/main.js"]
