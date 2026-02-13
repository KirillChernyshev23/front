FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies separately to leverage Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application (will be overridden by bind mount in dev)
COPY public ./public
COPY src ./src

ENV PORT=3000 \
    HOST=0.0.0.0 \
    CHOKIDAR_USEPOLLING=true

EXPOSE 3000

CMD ["npm", "start"]

