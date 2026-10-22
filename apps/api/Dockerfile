FROM node:20-alpine

WORKDIR /app

# Install curl for docker healthcheck
RUN apk add --no-cache curl

COPY package*.json ./
RUN npm install --omit=dev

COPY src/ ./src/
COPY package.json ./

EXPOSE 5000

CMD ["node", "src/server.js"]
