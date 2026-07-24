# Lidera tu Vida — Backend de producción

Backend real para la app **Lidera tu Vida · Plan de Crecimiento Personal** de
Gamarra Leadership. Reemplaza al demo de un solo archivo por un servidor con
autenticación real, contraseñas con hash y una base de datos que persiste de
verdad en disco.

## Qué incluye

- **Express** como servidor HTTP y API REST.
- **SQLite real** vía el módulo nativo `node:sqlite` de Node.js — no requiere
  compilar nada ni instalar un motor de base de datos aparte.
- **Contraseñas con hash bcrypt** (nunca se guarda una contraseña en texto plano).
- **Sesiones con JWT** (tokens firmados que expiran solos).
- **Roles** (`mentee` / `mentor`) con rutas protegidas: un mentor puede ver el
  avance de todo su grupo; un participante solo ve lo suyo.
- **Semaforización calculada en el servidor** (rojo/amarillo/verde), para que
  la vista de mentor sea siempre confiable y no dependa de cálculos hechos en
  el navegador de cada participante.
- **Frontend incluido** (`public/index.html`) con la misma identidad visual de
  Gamarra Leadership (navy + dorado, logo real incrustado), ya conectado a la
  API real en lugar de guardar datos solo en el navegador.
- **Arranque a prueba de errores**: si no existe el archivo `.env`, el
  servidor lo crea solo con un secreto seguro generado al azar, en vez de
  caerse.
- **Exportación a PDF**: cada participante puede descargar su plan completo;
  un mentor puede descargar el de cualquier participante o un **reporte
  consolidado de todo el grupo** en un solo PDF.
- **Avisos por correo**: cuando el semáforo de un área pasa a rojo, se avisa
  automáticamente al participante y a todos los mentores (funciona sin
  configurar SMTP: en ese caso, el correo se muestra en la consola del
  servidor en vez de enviarse).

## Obtener un link público (sin usar la terminal)

Si solo quieres un link para que otras personas entren a la app, la ruta más
corta es Render, usando su interfaz web (no hace falta instalar nada en tu
computadora):

1. **Descomprime este .zip** en tu computadora.
2. Crea una cuenta gratis en [github.com](https://github.com) si no tienes una.
3. Crea un repositorio nuevo (puede ser privado) y usa el botón
   **"uploading an existing file"** de GitHub para arrastrar y soltar todos
   los archivos descomprimidos (no hace falta usar git ni la terminal).
4. Crea una cuenta gratis en [render.com](https://render.com) (no pide
   tarjeta para el plan gratuito).
5. En Render: **New +** → **Blueprint** → conecta el repositorio que acabas
   de crear. Este proyecto ya incluye un archivo `render.yaml`, así que
   Render configura todo solo (incluyendo un `JWT_SECRET` seguro generado
   automáticamente) y solo tienes que darle a "Apply".
6. En un par de minutos, Render te da un link como
   `https://lidera-tu-vida.onrender.com` — ese es tu link directo a la app.

**Importante sobre el plan gratuito de Render:** el servicio "se duerme" tras
15 minutos sin uso (la primera visita después de eso tarda ~30-60 segundos
en despertar), y **no conserva los datos guardados en disco** si el servicio
se reinicia o vuelves a desplegar — es decir, con el plan free tus
participantes podrían perder su progreso en algún momento. Para una prueba o
demo rápida está perfecto. Si vas a usarlo de verdad con tu grupo de
mentoría, sube el servicio al plan "Starter" (~7 USD/mes) y activa el disco
persistente (descomenta el bloque `disk` en `render.yaml`, ~0.25 USD/GB al
mes) para que los datos nunca se pierdan.

## Requisitos

- **Node.js 22.5 o superior.** El proyecto usa el módulo nativo `node:sqlite`
  (aún experimental en la serie 22.x), así que los scripts arrancan con la
  bandera `--experimental-sqlite`. Revisa tu versión con `node -v`.
  - Si tu versión de Node ya soporta `node:sqlite` de forma estable, puedes
    quitar la bandera `--experimental-sqlite` de los scripts en `package.json`.
  - Si tu proveedor de hosting no soporta Node 22.5+, la capa de datos vive
    toda en `src/db.js`: puedes reemplazarla por `pg` (PostgreSQL) sin tocar
    el resto de la app (ver sección "Crecer a Postgres" más abajo).

## Instalación y arranque local

```bash
cd lidera-tu-vida-backend
npm install
cp .env.example .env
```

Abre `.env` y reemplaza `JWT_SECRET` por un valor único y secreto. Puedes
generarlo con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Luego arranca el servidor:

```bash
npm start
```

Abre `http://localhost:3000` en el navegador. La primera vez, crea tu acceso
desde "Crear mi acceso" (elige el rol de participante o mentor).

La base de datos se crea sola en `data/lidera_tu_vida.sqlite` la primera vez
que arranca el servidor — no necesitas instalar ni configurar nada más.

## Variables de entorno (`.env`)

| Variable          | Para qué sirve                                                        |
|--------------------|------------------------------------------------------------------------|
| `PORT`             | Puerto del servidor (por defecto 3000)                                |
| `JWT_SECRET`       | Secreto para firmar los tokens de sesión. **Obligatorio y único.**    |
| `JWT_EXPIRES_IN`   | Cuánto dura una sesión antes de pedir volver a iniciar sesión (`12h`) |
| `CORS_ORIGIN`      | Dominio permitido si sirves el frontend en otro origen                |
| `DB_PATH`          | Ruta del archivo SQLite, si quieres cambiarla                         |
| `SMTP_HOST`        | Servidor SMTP para enviar avisos de semáforo en rojo (opcional; si se deja vacío, los correos solo se muestran en la consola) |
| `SMTP_PORT`        | Puerto SMTP (por defecto 587)                                         |
| `SMTP_SECURE`      | `true` si tu proveedor requiere TLS directo (normalmente `false` con el puerto 587) |
| `SMTP_USER` / `SMTP_PASS` | Credenciales de tu proveedor de correo                         |
| `SMTP_FROM`        | Remitente que verán los destinatarios                                 |

## Estructura del proyecto

```
lidera-tu-vida-backend/
├── server.js                 # arranque del servidor Express (auto-crea .env si falta)
├── src/
│   ├── db.js                 # toda la capa de base de datos (SQLite)
│   ├── auth.js               # JWT: firmar y verificar tokens
│   ├── growth.js             # cálculo de semaforización y progreso
│   ├── pdf.js                # generación de PDF (plan individual y reporte de grupo)
│   ├── mail.js                # envío de correos (con modo de respaldo sin SMTP)
│   ├── semaforoWatcher.js    # detecta cuándo un area pasa a rojo y dispara el correo
│   ├── assets/                # logo incrustado en los PDFs
│   └── routes/
│       ├── auth.js           # POST /api/auth/register, /login
│       ├── data.js           # GET/PUT/POST/DELETE del plan de cada persona + export/pdf
│       └── mentor.js         # GET /api/mentor/mentees... + reporte consolidado
├── public/
│   └── index.html            # frontend (misma UI, ahora habla con la API)
├── data/                      # aquí vive el archivo .sqlite (se crea solo)
├── Dockerfile, docker-compose.yml, .dockerignore
├── .env.example
└── package.json
```

## Resumen de la API

Todas las rutas bajo `/api/data` y `/api/mentor` requieren el encabezado
`Authorization: Bearer <token>` que devuelve el login o el registro.

| Método | Ruta                                | Qué hace                                      |
|--------|--------------------------------------|------------------------------------------------|
| POST   | `/api/auth/register`                | Crea una cuenta (`nombre`, `username`, `password`, `rol`) |
| POST   | `/api/auth/login`                   | Inicia sesión, devuelve el token                |
| GET    | `/api/data`                          | Trae todo tu plan + semáforos                   |
| GET    | `/api/data/export/pdf`               | Descarga tu plan completo en PDF con la identidad de Gamarra Leadership |
| PUT    | `/api/data/compromiso`               | Guarda el compromiso (pasos 1 y 2)              |
| PUT    | `/api/data/foda`                     | Guarda el diagnóstico FODA                      |
| PUT    | `/api/data/areas/:area`              | Guarda meta, notas y métricas de un área        |
| POST   | `/api/data/planificador`             | Agrega una actividad diaria                     |
| DELETE | `/api/data/planificador/:index`      | Elimina una actividad                           |
| POST   | `/api/data/bitacora`                 | Agrega una entrada de reflexión                 |
| DELETE | `/api/data/bitacora/:index`          | Elimina una entrada                             |
| POST   | `/api/data/compartir`                | Agrega un registro de acompañamiento            |
| DELETE | `/api/data/compartir/:index`         | Elimina un registro                             |
| GET    | `/api/mentor/mentees`                | Lista a todos los participantes con su semáforo (solo mentores) |
| GET    | `/api/mentor/mentees/export/pdf`     | Descarga un PDF consolidado con el avance de todo el grupo (solo mentores) |
| GET    | `/api/mentor/mentees/:username`      | Detalle completo de un participante (solo mentores) |
| GET    | `/api/mentor/mentees/:username/export/pdf` | Descarga el plan en PDF de un participante (solo mentores) |

## Seguridad ya incluida

- Contraseñas con `bcrypt` (costo 12).
- Tokens JWT firmados con expiración automática.
- `helmet` para cabeceras HTTP seguras por defecto.
- Límite de intentos (`express-rate-limit`) en login/registro para frenar
  ataques de fuerza bruta.
- Mensajes de error genéricos en login (no revelan si falló el usuario o la clave).
- Validación de campos en cada endpoint.

**Antes de usarlo con datos reales de tu programa de mentoría:**
1. Sirve la app solo por **HTTPS** (usa un proxy como Nginx/Caddy o la terminación
   TLS de tu proveedor de hosting).
2. Cambia `JWT_SECRET` por un valor propio y no lo compartas.
3. Haz respaldos periódicos del archivo `data/lidera_tu_vida.sqlite`.
4. Si vas a tener mucha gente escribiendo datos a la vez de forma sostenida,
   considera migrar a Postgres (ver abajo) — SQLite es perfectamente
   suficiente para un piloto o un grupo de mentoría de tamaño normal.

## Exportar el plan a PDF

Cualquier participante puede descargar su plan completo (compromiso, FODA,
áreas, planificador, bitácora y acompañamiento) como PDF con el logo y los
colores de Gamarra Leadership, desde el botón **"Descargar mi plan en PDF"**
en el panel. Un mentor puede descargar el PDF de cualquier participante de su
grupo desde la vista de mentor.

El PDF se genera con `pdfkit` (JavaScript puro, sin dependencias nativas) en
`src/pdf.js`. Si quieres cambiar el diseño del PDF (colores, secciones,
orden), ese es el único archivo que necesitas tocar.

## Avisos por correo cuando un semáforo pasa a rojo

Cada vez que se guarda una meta/métrica de un área o se registra/elimina una
actividad del planificador, el servidor recalcula los 4 semáforos del
participante y los compara contra el último estado guardado
(`last_semaforos` en la base de datos). Si **alguna área acaba de pasar a
rojo** (antes no era rojo, ahora sí), se envía un correo:

- Al propio participante.
- A **todos** los usuarios con rol de mentor.

Si un área ya estaba en rojo, no se reenvía el aviso en cada guardado — solo
se notifica la transición, para no saturar de correos.

Para que el envío sea real, configura estas variables en tu `.env`:

```
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-usuario
SMTP_PASS=tu-clave
SMTP_FROM=Lidera tu Vida <no-reply@tudominio.com>
```

**Si dejas `SMTP_HOST` vacío, la aplicación no falla**: en vez de enviar el
correo, escribe en la consola del servidor exactamente qué se habría
enviado y a quién. Así puedes probar toda la función sin tener todavía un
proveedor de correo configurado.

La lógica vive en `src/mail.js` (plantilla y envío) y
`src/semaforoWatcher.js` (detección de la transición a rojo).

## Reporte consolidado del grupo (PDF)

Desde la vista de mentor, el botón **"Reporte consolidado (PDF)"** descarga
un único PDF con el avance de **todos** los participantes: una tabla resumen
con el semáforo de cada área por persona, seguida de una sección breve por
participante (meta de cada área, su compromiso y su última actividad
registrada). Útil para revisiones grupales o reportar el estado del programa
a otros interesados. Endpoint: `GET /api/mentor/mentees/export/pdf`.

## Despliegue con Docker

El proyecto incluye un `Dockerfile` y un `docker-compose.yml` listos para usar:

```bash
cp .env.example .env
# edita .env y define JWT_SECRET

docker compose up -d --build
```

Esto construye la imagen (Node.js 22), levanta el contenedor en el puerto
3000 y guarda la base de datos SQLite en un **volumen nombrado** (`ltv_data`)
que sobrevive a reinicios y reconstrucciones del contenedor. Para ver los
logs: `docker compose logs -f`. Para detenerlo: `docker compose down` (el
volumen con tus datos no se borra a menos que uses `docker compose down -v`).

Si prefieres construir la imagen manualmente sin compose:

```bash
docker build -t lidera-tu-vida .
docker run -d -p 3000:3000 \
  -e JWT_SECRET=tu-secreto-unico \
  -v ltv_data:/app/data \
  --name lidera-tu-vida \
  lidera-tu-vida
```

## Despliegue sin Docker

Cualquier proveedor que corra Node.js sirve (Railway, Render, Fly.io, un VPS
propio, etc.). Pasos generales:

1. Sube el proyecto (sin `node_modules` ni `.env`).
2. Configura las variables de entorno del `.env` en el panel del proveedor.
3. Comando de build: `npm install`. Comando de arranque: `npm start`.
4. Asegúrate de que el disco donde vive `data/` sea persistente (algunos
   proveedores "serverless" borran el disco en cada despliegue — en ese caso
   usa un volumen persistente o migra a Postgres).

## Crecer a Postgres (opcional, para cuando el programa escale)

Toda la lógica de acceso a datos está aislada en `src/db.js`. Si en el futuro
necesitas Postgres (por ejemplo, para tener varias instancias del servidor
corriendo a la vez), los pasos son:

1. `npm install pg`
2. Reescribe `src/db.js` para que las mismas funciones exportadas
   (`createUser`, `getUserByUsername`, `getUserData`, `setCompromiso`, etc.)
   usen consultas `pg` en vez de `node:sqlite`. Como el resto de la app solo
   llama a esas funciones, no tienes que tocar las rutas ni el frontend.
3. Crea las tablas equivalentes con `CREATE TABLE` en Postgres (mismo diseño
   de columnas que ves en `db.js`).

## Notas sobre el logo

El logo de Gamarra Leadership viene incrustado como imagen (base64) dentro de
`public/index.html`, recortado del material de marca que compartiste. Si
tienes el archivo original en SVG o PNG con fondo transparente, se vería aún
más nítido — puedes reemplazar la constante `LOGO_DATA_URI` al inicio del
`<script>` por la ruta a ese archivo (por ejemplo `/logo.png` sirviéndolo
desde `public/`).
