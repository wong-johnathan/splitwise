FROM node:20-alpine AS dev
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

FROM node:20-alpine AS prod
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY package.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
USER appuser
EXPOSE 4000
CMD ["node", "dist/index.js"]
