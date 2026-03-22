# Use Node.js 20 Alpine as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose the port used by the backend
EXPOSE 5001

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
