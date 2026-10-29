# phpMyAdmin durci (PHP-FPM + nginx)

Versions : phpMyAdmin 5.2.3, PHP 8.5.12 (correctifs RCE d'octobre 2026).

## Démarrage

    openssl rand -hex 16 > secrets/pma_blowfish   # 32 caractères exactement
    chmod 644 secrets/pma_blowfish                 # lisible par www-data (uid 82)
    # éditez config.inc.php : $cfg['Servers'][$i]['host']
    docker compose build --pull --no-cache
    docker compose up -d

Interface : http://127.0.0.1:8080 (à placer derrière un reverse proxy HTTPS,
car les cookies de session sont en mode Secure).

## Mise à jour
Changez PHP_VERSION / PMA_VERSION dans docker-compose.yml (et le tag image), puis rebuild avec --pull --no-cache.
