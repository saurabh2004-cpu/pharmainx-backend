# Base image
FROM node:22-slim

# Install OpenSSL and required deps
RUN apt-get update -y && \
    apt-get install -y openssl wget && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install deps
RUN pnpm install

# Copy source code
COPY . .

# Generate Prisma Client and Build
# Pass a dummy DATABASE_URL to avoid errors during generation if config requires it
RUN DATABASE_URL="postgresql://dummy:5432/dummy" pnpm run generate && pnpm run build

# Copy init script
COPY init.sh .
RUN chmod +x init.sh

EXPOSE 3000

CMD ["./init.sh"]
