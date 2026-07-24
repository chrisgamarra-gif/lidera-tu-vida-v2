# Imagen con Node.js 22 (incluye node:sqlite tras la bandera --experimental-sqlite)
FROM node:22-slim

WORKDIR /app

# Instala dependencias primero para aprovechar la cache de capas de Docker
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copia el resto del proyecto
COPY . .

# La base de datos SQLite vive en /app/data; usa un volumen para que persista
# entre despliegues (ver docker-compose.yml).
RUN mkdir -p /app/data

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "--experimental-sqlite", "server.js"]
