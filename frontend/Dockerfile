# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
# copia o WASM do MediaPipe e descarrega o modelo de mãos (fica tudo local)
RUN npm run setup-mediapipe && npm run build

# ---- servir ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
