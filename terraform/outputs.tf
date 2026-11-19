output "project_id" {
  description = "ID проекта Selectel (создан вручную, принят в state через import)."
  value       = selectel_vpc_project_v2.main.id
}

output "bucket_name" {
  description = "Имя бакета — BUCKET в job cd (.github/workflows/ci.yml)."
  value       = openstack_objectstorage_container_v1.site.name
}

output "s3_endpoint" {
  description = "Эндпоинт S3 для s3cmd и aws-cli."
  value       = "https://s3.${var.region}.storage.selcloud.ru"
}

output "domain_cname_target" {
  description = "Значение CNAME-записи для пользовательского домена."
  value       = contains(["ru-6", "ru-7", "gis-1"], var.region) ? "access.ru-6.storage.selcloud.ru" : "access.ru-1.storage.selcloud.ru"
}

output "deploy_access_key" {
  description = "Access Key ID для выкладки."
  value       = selectel_iam_s3_credentials_v1.deploy.access_key
  sensitive   = true
}

output "deploy_secret_key" {
  description = "Secret Key для выкладки. Посмотреть: terraform output -raw deploy_secret_key"
  value       = selectel_iam_s3_credentials_v1.deploy.secret_key
  sensitive   = true
}

output "next_steps" {
  description = "Что осталось сделать руками — этого нет в API."
  value       = <<-EOT

    Создано: сервисный пользователь выкладки, ключи S3, бакет.

    Настроить s3cmd:
      s3cmd --configure
        Access Key : terraform output -raw deploy_access_key
        Secret Key : terraform output -raw deploy_secret_key
        S3 Endpoint: s3.${var.region}.storage.selcloud.ru
        DNS-style  : %(bucket)s.s3.${var.region}.storage.selcloud.ru
        Region     : ${var.region}

    Выкладка — job cd в .github/workflows/ci.yml при push в main.
    GitHub → Settings → Environments → it-drill → secrets:
      S3_ACCESS_KEY = terraform output -raw deploy_access_key
      S3_SECRET_KEY = terraform output -raw deploy_secret_key

    Руками в панели (через API не настраивается):
      1. Вкладка «Веб-сайт» → хостинг → /${var.index_document}
         и страница ошибки: код 200, путь /${var.error_document}
      2. Вкладка «Домены» → привязать домен
         CNAME → ${contains(["ru-6", "ru-7", "gis-1"], var.region) ? "access.ru-6.storage.selcloud.ru" : "access.ru-1.storage.selcloud.ru"}
      3. S3 → SSL-сертификаты → загрузить сертификат
      4. Конфигурация → Лимиты: объём 1 ГБ, количество объектов 100
      5. Проверить: DOMAIN=https://${var.site_domain} bash tools/audit.sh

  EOT
}
