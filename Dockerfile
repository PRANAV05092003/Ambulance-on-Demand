# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Runtime stage
FROM node:18-alpine

WORKDIR /app

# Copy built assets from builder
COPY --from=builder /app .

# Create necessary directories
RUN mkdir -p logs

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "server.js"]
