# syntax=docker/dockerfile:1
ARG PHP_VERSION=8.5.12
ARG PMA_VERSION=5.2.3

# ---------- Étape 1 : phpMyAdmin (archive vérifiée par SHA-256) ----------
FROM alpine:3.24 AS src
ARG PMA_VERSION
RUN apk add --no-cache curl unzip \
    && cd /tmp \
    && curl -fsSLO https://files.phpmyadmin.net/phpMyAdmin/${PMA_VERSION}/phpMyAdmin-${PMA_VERSION}-all-languages.zip \
    && curl -fsSLO https://files.phpmyadmin.net/phpMyAdmin/${PMA_VERSION}/phpMyAdmin-${PMA_VERSION}-all-languages.zip.sha256 \
    && sha256sum -c phpMyAdmin-${PMA_VERSION}-all-languages.zip.sha256 \
    && unzip -q phpMyAdmin-${PMA_VERSION}-all-languages.zip -d /tmp \
    && mv /tmp/phpMyAdmin-${PMA_VERSION}-all-languages /pma \
    && rm -rf /pma/setup /pma/examples \
    && chmod -R go-w /pma
COPY config.inc.php /pma/config.inc.php

# ---------- Étape 2 : PHP-FPM ----------
# Le processus maître démarre en root (nécessaire pour lancer les workers en www-data),
# mais le conteneur tourne sans capabilities sauf SETUID/SETGID (voir docker-compose.yml).
FROM php:${PHP_VERSION}-fpm-alpine AS php
RUN apk upgrade --no-cache \
    && docker-php-ext-install mysqli \
    && mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY hardening.ini /usr/local/etc/php/conf.d/99-hardening.ini
COPY fpm.conf      /usr/local/etc/php-fpm.d/zz-pma.conf
# Code appartenant à root, en lecture seule : PHP ne peut pas le modifier
COPY --from=src /pma /var/www/html
EXPOSE 9000

# ---------- Étape 3 : nginx non-root ----------
FROM nginxinc/nginx-unprivileged:mainline-alpine AS web
USER root
RUN apk upgrade --no-cache
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Fichiers statiques uniquement : pas de config.inc.php
COPY --from=src /pma /var/www/html
RUN rm -f /var/www/html/config.inc.php
USER nginx
EXPOSE 8080
