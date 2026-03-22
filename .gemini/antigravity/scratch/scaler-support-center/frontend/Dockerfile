# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy the built dist folder and health check script
COPY --from=builder /app/dist ./dist

# Create a simple Node.js server that serves the frontend and has a health endpoint
RUN npm install -g http-server

EXPOSE 3000

# Ensure the app listens on the PORT environment variable (Railway injects this)
# http-server will use the PORT env var, defaulting to 3000
CMD ["sh", "-c", "http-server dist -p ${PORT:-3000} -c-1"]
