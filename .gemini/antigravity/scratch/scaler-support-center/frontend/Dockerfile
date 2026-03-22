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

# Copy the built dist folder
COPY --from=builder /app/dist ./dist

# Install a simple HTTP server
RUN npm install -g http-server

EXPOSE 3000

# Start the HTTP server on port 3000, listening on all interfaces
CMD ["http-server", "dist", "-p", "3000", "-c-1"]
