terraform {
  required_version = ">= 1.16.0"

  required_providers {
    selectel = {
      source  = "registry.terraform.io/selectel/selectel"
      version = "~> 8.3"
    }

    openstack = {
      source  = "registry.terraform.io/terraform-provider-openstack/openstack"
      version = "~> 3.4"
    }
  }

  cloud {
    organization = "it-drill-tech"

    workspaces {
      name = "it-drill-tech"
    }
  }
}
