locals {
  state_bucket_name = coalesce(var.state_bucket_name, "${var.project_id}-task-manager-terraform-state")
}

resource "google_storage_bucket" "terraform_state" {
  project                     = var.project_id
  name                        = local.state_bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      num_newer_versions = 20
      with_state         = "ARCHIVED"
    }
  }
}
