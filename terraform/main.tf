# Проект создан вручную
import {
  to = selectel_vpc_project_v2.main
  id = var.project_id
}

resource "selectel_vpc_project_v2" "main" {
  name = var.project_name

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}

resource "selectel_iam_serviceuser_v1" "deploy" {
  name     = var.deploy_user_name
  password = var.deploy_user_password
  enabled  = true

  role {
    role_name  = "member"
    scope      = "project"
    project_id = selectel_vpc_project_v2.main.id
  }

  role {
    role_name  = "s3.admin"
    scope      = "project"
    project_id = selectel_vpc_project_v2.main.id
  }
}

resource "selectel_iam_s3_credentials_v1" "deploy" {
  name       = "${selectel_vpc_project_v2.main.name}-deploy"
  user_id    = selectel_iam_serviceuser_v1.deploy.id
  project_id = selectel_vpc_project_v2.main.id
}

resource "openstack_objectstorage_container_v1" "site" {
  region = var.region
  name   = var.bucket_name

  container_read = var.public_read ? ".r:*" : ""

  container_write = ""

  versioning = var.versioning

  # Метаданные Swift для статического сайта (X-Container-Meta-*).
  # Новая панель S3 настраивает хостинг на вкладке «Веб-сайт» и может
  # не читать эти заголовки. Если корень не отдаёт index.html —
  # включите хостинг в панели руками.
  metadata = {
    "Web-Index" = var.index_document
    "Web-Error" = var.error_document
  }

  # false: случайный terraform destroy не должен молча стереть сайт.
  force_destroy = var.force_destroy

  # Пользователь и его роль должны существовать раньше, чем мы пойдём
  # создавать бакет от его имени.
  depends_on = [
    selectel_iam_serviceuser_v1.deploy,
    selectel_vpc_project_v2.main,
  ]
}
