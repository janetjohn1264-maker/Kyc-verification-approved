# ---- build stage: run the project's own vite build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime stage: tiny dependency-free static server for dist/ ----
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY serve-static.cjs ./
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "serve-static.cjs"]
