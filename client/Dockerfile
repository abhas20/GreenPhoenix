# ==============================================================================
# Stage 1: Build Stage using Bun
# ==============================================================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Cache dependencies by copying lockfile and package manifest first
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy application source code
COPY . .

# Build Arguments & Environment Configuration for Vite Build
ARG VITE_API_URL=""
ARG VITE_APP_TITLE="GreenPhoenix Community Aid Navigator"
ARG VITE_DEFAULT_LANGUAGE="en"
ARG VITE_ENABLE_MOCK_FALLBACK="true"

ENV VITE_API_URL=$VITE_API_URL \
    VITE_APP_TITLE=$VITE_APP_TITLE \
    VITE_DEFAULT_LANGUAGE=$VITE_DEFAULT_LANGUAGE \
    VITE_ENABLE_MOCK_FALLBACK=$VITE_ENABLE_MOCK_FALLBACK

# Compile TypeScript and bundle production assets with Vite
RUN bun run build

# ==============================================================================
# Stage 2: Production Web Server using Nginx Alpine
# ==============================================================================
FROM nginx:1.27-alpine AS runner

# Set default backend upstream for API proxying (overridable via docker run/compose)
ENV BACKEND_URL=http://server:8000

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx template (envsubst processes this automatically on container boot)
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Also provide default conf if template runner is bypassed
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose standard HTTP port
EXPOSE 80

# Container Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
