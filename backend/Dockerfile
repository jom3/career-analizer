FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN npm ci

COPY backend ./backend

WORKDIR /app/backend
RUN DATABASE_URL="postgresql://career_analyzer:career_analyzer_dev@localhost:5432/career_analyzer?schema=public" \
    npx prisma generate
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/backend/package.json /app/backend/package.json
COPY --from=build /app/backend/dist /app/backend/dist
COPY --from=build /app/backend/prisma /app/backend/prisma
COPY --from=build /app/backend/prisma.config.ts /app/backend/prisma.config.ts

RUN mkdir -p /app/backend/uploads && chown -R node:node /app/backend

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]