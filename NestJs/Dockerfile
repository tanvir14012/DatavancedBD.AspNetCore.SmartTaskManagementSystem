FROM node:24.19.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json eslint.config.mjs .prettierrc.json ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src
COPY test ./test
RUN npm run build

FROM node:24.19.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NODE_OPTIONS=--enable-source-maps \
    PORT=8080
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN groupadd --system --gid 10001 nestjs \
    && useradd --system --uid 10001 --gid nestjs --home-dir /nonexistent --shell /usr/sbin/nologin nestjs
USER nestjs
EXPOSE 8080
ENTRYPOINT ["node", "dist/src/main.js"]
