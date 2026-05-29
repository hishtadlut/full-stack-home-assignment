resource "google_cloud_run_v2_service" "api" {
  project             = var.project_id
  name                = local.api_service_name
  location            = var.region
  ingress             = var.cloud_run_ingress
  deletion_protection = var.deletion_protection
  labels              = local.labels

  lifecycle {
    ignore_changes = [
      client,
      client_version,
    ]
  }

  template {
    service_account                  = google_service_account.runtime.email
    timeout                          = var.api_timeout
    max_instance_request_concurrency = var.api_concurrency

    scaling {
      min_instance_count = var.api_min_instances
      max_instance_count = var.api_max_instances
    }

    vpc_access {
      egress = "PRIVATE_RANGES_ONLY"

      network_interfaces {
        network    = google_compute_network.main.name
        subnetwork = google_compute_subnetwork.serverless.name
      }
    }

    containers {
      image = var.backend_image

      ports {
        container_port = var.container_port
      }

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }

        cpu_idle          = true
        startup_cpu_boost = true
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "CORS_ORIGINS"
        value = join(",", local.cors_origins)
      }

      env {
        name  = "REDIS_URL"
        value = "redis://${google_redis_instance.refresh_tokens.host}:${google_redis_instance.refresh_tokens.port}"
      }

      dynamic "env" {
        for_each = local.api_secret_env

        content {
          name = env.key

          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.managed[env.value].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.required["run.googleapis.com"],
    google_redis_instance.refresh_tokens,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.jwt_secret,
  ]
}

resource "google_cloud_run_v2_service" "web" {
  project             = var.project_id
  name                = local.web_service_name
  location            = var.region
  ingress             = var.cloud_run_ingress
  deletion_protection = var.deletion_protection
  labels              = local.labels

  lifecycle {
    ignore_changes = [
      client,
      client_version,
    ]
  }

  template {
    service_account                  = google_service_account.runtime.email
    timeout                          = var.web_timeout
    max_instance_request_concurrency = var.web_concurrency

    scaling {
      min_instance_count = var.web_min_instances
      max_instance_count = var.web_max_instances
    }

    containers {
      image = var.frontend_image

      ports {
        container_port = var.container_port
      }

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }

        cpu_idle          = true
        startup_cpu_boost = true
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [google_project_service.required["run.googleapis.com"]]
}

resource "google_cloud_run_v2_job" "migrate" {
  project             = var.project_id
  name                = local.migrate_job_name
  location            = var.region
  deletion_protection = var.deletion_protection
  labels              = local.labels

  lifecycle {
    ignore_changes = [
      client,
      client_version,
    ]
  }

  template {
    template {
      service_account = google_service_account.runtime.email
      timeout         = "600s"
      max_retries     = 1

      vpc_access {
        egress = "PRIVATE_RANGES_ONLY"

        network_interfaces {
          network    = google_compute_network.main.name
          subnetwork = google_compute_subnetwork.serverless.name
        }
      }

      containers {
        image   = var.backend_image
        command = ["npx"]
        args    = ["prisma", "migrate", "deploy"]

        env {
          name  = "NODE_ENV"
          value = "production"
        }

        env {
          name  = "CORS_ORIGINS"
          value = join(",", local.cors_origins)
        }

        dynamic "env" {
          for_each = local.api_secret_env

          content {
            name = env.key

            value_source {
              secret_key_ref {
                secret  = google_secret_manager_secret.managed[env.value].secret_id
                version = "latest"
              }
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required["run.googleapis.com"],
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.jwt_secret,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "api_public_invoker" {
  project  = var.project_id
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "web_public_invoker" {
  project  = var.project_id
  location = google_cloud_run_v2_service.web.location
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
