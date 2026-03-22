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

# Copy the built dist folder and server script
COPY --from=builder /app/dist ./dist
COPY package*.json ./
COPY server.cjs ./

# Install only production dependencies
RUN npm install --only=production

EXPOSE 3000

# Start the Node.js server
CMD ["node", "server.cjs"]
