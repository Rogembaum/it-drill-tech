provider "selectel" {
  domain_name = var.selectel_domain_name
  username    = var.tf_user_name
  password    = var.tf_user_password
  auth_url    = var.auth_url
  auth_region = var.auth_region
}

provider "openstack" {
  auth_url            = var.auth_url
  region              = var.region
  domain_name         = var.selectel_domain_name
  tenant_id           = selectel_vpc_project_v2.main.id
  user_name           = selectel_iam_serviceuser_v1.deploy.name
  password            = selectel_iam_serviceuser_v1.deploy.password
  user_domain_name    = var.selectel_domain_name
  project_domain_name = var.selectel_domain_name
}
