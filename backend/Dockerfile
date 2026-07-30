FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist

# Create non-root application user
RUN useradd --create-home appuser \
    && chown -R appuser:appuser /app
USER appuser

CMD ["npm", "start"]