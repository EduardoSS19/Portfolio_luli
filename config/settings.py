import os
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured


BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY precisa estar definida quando DEBUG estiver desativado."
        )
    SECRET_KEY = "local-development-only"
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]
# Domínios públicos no Cloudflare e domínio interno/gerado do Railway.
for extra_host in (
    "www.lulibecker.com.br",
    "lulibecker.com.br",
    os.environ.get("RAILWAY_PUBLIC_DOMAIN"),
    "healthcheck.railway.app",
):
    if extra_host and extra_host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(extra_host)

# Origens confiáveis para o login do /admin (CSRF), derivadas do ALLOWED_HOSTS.
# Também aceita extras pela variável CSRF_TRUSTED_ORIGINS (separadas por vírgula).
CSRF_TRUSTED_ORIGINS = []
for host in ALLOWED_HOSTS:
    if host in ("localhost", "127.0.0.1", "healthcheck.railway.app", "*"):
        continue
    origin = f"https://*{host}" if host.startswith(".") else f"https://{host}"
    if origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(origin)
for origin in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(","):
    origin = origin.strip()
    if origin and origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(origin)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "cloudinary_storage",
    "cloudinary",
    "portfolio.apps.PortfolioConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        # Prioriza os templates editoriais do projeto sobre os templates padrão
        # do Django Admin (o app portfolio vem depois de django.contrib.admin).
        "DIRS": [BASE_DIR / "portfolio" / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
        ssl_require=(
            not DEBUG
            and os.environ.get("DATABASE_SSL_REQUIRE", "true").lower() == "true"
        ),
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
STATIC_ROOT = BASE_DIR / "staticfiles"
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
STATICFILES_DIRS = [FRONTEND_DIST] if FRONTEND_DIST.is_dir() else ([BASE_DIR / "public"] if (BASE_DIR / "public").is_dir() else [])
CLOUDINARY_STORAGE = {
    "CLOUD_NAME": os.environ.get("CLOUDINARY_CLOUD_NAME"),
    "API_KEY": os.environ.get("CLOUDINARY_API_KEY"),
    "API_SECRET": os.environ.get("CLOUDINARY_API_SECRET"),
}
cloudinary_configured = all(CLOUDINARY_STORAGE.values())
if not DEBUG and not cloudinary_configured:
    raise ImproperlyConfigured("Configure as credenciais do Cloudinary para uploads em produção.")

STORAGES = {
    "default": {
        "BACKEND": (
            "cloudinary_storage.storage.MediaCloudinaryStorage"
            if cloudinary_configured
            else "django.core.files.storage.FileSystemStorage"
        ),
    },
    "staticfiles": {
        "BACKEND": (
            "django.contrib.staticfiles.storage.StaticFilesStorage"
            if DEBUG
            else "whitenoise.storage.CompressedManifestStaticFilesStorage"
        ),
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = (
    not DEBUG and os.environ.get("SECURE_SSL_REDIRECT", "true").lower() == "true"
)
SECURE_REDIRECT_EXEMPT = [r"^api/health/$"]
SECURE_HSTS_SECONDS = int(
    os.environ.get("SECURE_HSTS_SECONDS", "31536000" if not DEBUG else "0")
)
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
# Permite que o próprio site seja exibido no iframe de prévia do CMS.
# SAMEORIGIN continua bloqueando incorporação por sites externos (clickjacking).
X_FRAME_OPTIONS = "SAMEORIGIN"
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
if RESEND_API_KEY:
    _default_email_backend = "config.email_backends.ResendEmailBackend"
elif DEBUG:
    _default_email_backend = "django.core.mail.backends.console.EmailBackend"
else:
    _default_email_backend = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", _default_email_backend)
EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "true").lower() == "true"
EMAIL_USE_SSL = os.environ.get("EMAIL_USE_SSL", "false").lower() == "true"
DEFAULT_FROM_EMAIL = os.environ.get(
    "DEFAULT_FROM_EMAIL",
    EMAIL_HOST_USER or ("webmaster@localhost" if DEBUG else ""),
)
EMAIL_TIMEOUT = 15
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")

if EMAIL_USE_TLS and EMAIL_USE_SSL:
    raise ImproperlyConfigured("EMAIL_USE_TLS e EMAIL_USE_SSL não podem estar ativos juntos.")