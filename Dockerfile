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
RUN python manage.py collectstatic --noinput

EXPOSE 10000
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py setup_admin && exec gunicorn config.wsgi:application --bind 0.0.0.0:10000"]