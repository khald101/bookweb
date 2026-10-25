FROM node:20-bookworm-slim

WORKDIR /app

# Install system dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code and books
COPY . .

# Ensure data and upload directories exist and are writable
RUN mkdir -p /app/public/uploads/books /app/public/uploads/covers /app/data && \
    chmod -R 777 /app/public/uploads /app/data

# Build production Next.js app
RUN npm run build

# Default port for Hugging Face Spaces (7860) or cloud providers
ENV PORT=7860
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

EXPOSE 7860

CMD ["npm", "run", "start", "--", "-p", "7860", "-H", "0.0.0.0"]
