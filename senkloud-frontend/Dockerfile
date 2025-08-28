FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies first (cache efficient)
COPY package*.json ./
RUN npm install --production

# Copy app source and build it
COPY . .
RUN npm run build

# Expose port 8080 and serve built app
EXPOSE 8080
CMD ["npm", "run", "start"]
