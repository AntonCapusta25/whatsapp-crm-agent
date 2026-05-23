# Stage 1: Build the React frontend
FROM node:18-alpine AS builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Run the Node backend with Puppeteer
FROM ghcr.io/puppeteer/puppeteer:latest
WORKDIR /app

# Switch to root to perform installations and set permissions
USER root

# Copy backend dependencies
COPY package*.json ./
RUN npm ci

# Copy backend files and built frontend assets
COPY . .
COPY --from=builder /app/frontend/dist ./frontend/dist

# Ensure the correct permissions on the working directory
RUN chown -R pptruser:pptruser /app

# Switch back to pptruser for security
USER pptruser

# Expose server port
EXPOSE 3005

# Configure chromium paths
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome-stable"
ENV PORT=3005

# Start command
CMD ["npm", "start"]
