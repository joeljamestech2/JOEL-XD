FROM node:lts-buster

# Set working directory
WORKDIR /app

# Copy all local files
COPY . .

# Install dependencies
RUN npm install && npm install -g pm2

# Expose port
EXPOSE 9090

# Start bot
CMD ["npm", "start"]