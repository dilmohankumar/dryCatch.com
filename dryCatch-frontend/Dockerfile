# Multi-stage build — this is a static SPA (Vite build output is plain
# HTML/JS/CSS), so the final image is just nginx serving `dist/`, not a
# Node process. Keeps the production image minimal (rule #12).
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_API_URL is baked in at build time (Vite inlines env vars into the
# bundle) — passed as a build arg so staging/production point at their own
# API origin without maintaining separate source branches.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
