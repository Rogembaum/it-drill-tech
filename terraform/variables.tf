# ---------- доступ Terraform к Selectel ----------
variable "selectel_domain_name" {
  description = "Номер аккаунта Selectel."
  type        = string
  sensitive   = true
}

variable "tf_user_name" {
  description = "Сервисный пользователь, от имени которого работает Terraform."
  type        = string
  sensitive   = true
}

variable "tf_user_password" {
  description = "Пароль пользователя Terraform. Selectel: минимум 20 символов."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.tf_user_password) >= 20
    error_message = "Selectel требует пароль сервисного пользователя не короче 20 символов."
  }
}

variable "auth_url" {
  description = "Точка аутентификации Selectel Identity."
  type        = string
  default     = "https://cloud.api.selcloud.ru/identity/v3/"
}

variable "auth_region" {
  description = "Пул аутентификации. Не обязан совпадать с регионом бакета."
  type        = string
  default     = "ru-9"

  validation {
    condition     = contains(["ru-1", "ru-3", "ru-6", "ru-7", "ru-8", "ru-9", "gis-1"], var.auth_region)
    error_message = "Неизвестный пул. Сверьтесь со списком регионов Selectel."
  }
}

# ---------- что создаём ----------

variable "project_id" {
  description = <<-EOT
    ID уже существующего проекта. Нужен для import в state.
    IAM → Проекты → скопировать ID.
  EOT
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^[0-9a-fA-F]{32}$", var.project_id))
    error_message = "project_id должен быть 32-символьным hex ID проекта Selectel."
  }
}

variable "project_name" {
  description = "Имя уже существующего проекта. Terraform им не управляет (prevent_destroy + ignore_changes)."
  type        = string
  default     = "it-drill-tech"
}

variable "region" {
  description = "Пул, в котором создаётся бакет."
  type        = string
  default     = "ru-1"

  validation {
    condition     = contains(["ru-1", "ru-3", "ru-6", "ru-7", "ru-8", "ru-9", "gis-1"], var.region)
    error_message = "Неизвестный пул. Сверьтесь со списком регионов Selectel."
  }
}

variable "bucket_name" {
  description = <<-EOT
    Имя бакета. Правила Amazon S3: строчные латинские буквы, цифры, точки и дефисы,
    3–63 символа, начинается и заканчивается буквой или цифрой.
  EOT
  type        = string
  default     = "it-drill-tech"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.bucket_name))
    error_message = "Имя бакета не соответствует правилам S3: только строчные латинские буквы, цифры, точки и дефисы, 3–63 символа."
  }
}

variable "deploy_user_name" {
  description = "Сервисный пользователь выкладки: member (Swift/OpenStack) и s3.admin (S3-ключи) в проекте."
  type        = string
  sensitive   = true
}

variable "deploy_user_password" {
  description = <<-EOT
    Пароль пользователя выкладки. Минимум 20 символов,
    буквы обоих регистров, цифры и спецсимволы.
  EOT
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.deploy_user_password) >= 20
    error_message = "Selectel требует пароль сервисного пользователя не короче 20 символов."
  }
}

variable "site_domain" {
  description = "Публичный домен сайта, без схемы (для подсказок в output)."
  type        = string
  default     = "it-drill.tech"
}

# ---------- настройки бакета ----------

variable "public_read" {
  description = "Анонимное чтение объектов. Для сайта нужно true."
  type        = bool
  default     = true
}

variable "versioning" {
  description = "Хранить предыдущие версии объектов."
  type        = bool
  default     = true
}

variable "index_document" {
  description = "Главная страница сайта."
  type        = string
  default     = "index.html"
}

variable "error_document" {
  description = "Страница для несуществующего пути."
  type        = string
  default     = "index.html"
}

variable "force_destroy" {
  description = "Разрешить terraform destroy удалять непустой бакет."
  type        = bool
  default     = false
}
