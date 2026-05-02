FROM node:20-bookworm

# Set the working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files and pnpm lockfile to install dependencies reliably
COPY package.json pnpm-lock.yaml ./

# Install dependencies as root, then ensure ownership for the non-root user
RUN pnpm install --frozen-lockfile && chown -R node:node /app

## Switch to the non-root user
USER node

# Copy the rest of your application code
COPY --chown=node:node . .

EXPOSE 3000

# Start the application
CMD ["./start.sh"]