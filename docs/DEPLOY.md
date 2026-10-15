# Деплой на сервер

## Что нужно

- Сервер с Docker
- Домен и HTTPS (например, через Nginx или Caddy)
- PostgreSQL (можно управляемый в облаке)

## Шаги

1. Скопируйте проект на сервер.
2. Создайте файл `.env` рядом с `docker-compose.yml`:
   ```
   APP_SECRET=длинная-случайная-строка
   ```
   Остальные настройки (база, почта, оплата) — в `docker-compose.yml` или `.env`.
3. В `docker-compose.yml` поменяйте `APP_URL` и `API_URL` на адрес сайта, а `COOKIE_SECURE` на `true`.
4. Запустите:
   ```bash
   docker compose up -d --build
   ```
   Миграции базы применяются автоматически при старте.
5. Настройте HTTPS-прокси на порт `4000` и укажите `TRUST_PROXY=1`.

## Обязательно в production

| Переменная | Зачем |
|---|---|
| `APP_SECRET` | Подпись ссылок. Без неё сервер не запустится |
| `COOKIE_SECURE=true` | Cookies только по HTTPS |
| `MAIL_TRANSPORT=smtp` + `SMTP_*` | Реальная отправка писем |
| Ключи оплаты | См. [PAYMENTS.md](PAYMENTS.md) |

## Фото товаров

По умолчанию фото лежат в Docker volume `uploads`. Для облачного хранилища (Yandex Object Storage, AWS S3) укажите `STORAGE_DRIVER=s3` и переменные `S3_*`.

## Первый администратор

Тестовые данные (`db:seed`) создают аккаунт `admin@silt.store`. **Сразу смените ему пароль** или не запускайте seed в production и создайте администратора вручную через Prisma Studio.
