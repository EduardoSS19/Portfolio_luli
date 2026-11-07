FROM node:22-alpine AS frontend-build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . ./
COPY --from=frontend-build /app/dist ./frontend/dist
# Build static files with the same manifest-based storage used in production.
# Dummy Cloudinary values satisfy the production settings check; collectstatic
# writes local static assets and does not upload media.
RUN DEBUG=false DJANGO_SECRET_KEY=build-only-not-a-secret CLOUDINARY_CLOUD_NAME=build-only CLOUDINARY_API_KEY=0 CLOUDINARY_API_SECRET=build-only python manage.py collectstatic --noinput

EXPOSE 10000
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py setup_admin && exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-10000} --workers ${WEB_CONCURRENCY:-2} --timeout 120"]
