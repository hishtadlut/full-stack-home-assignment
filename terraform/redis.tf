resource "google_redis_instance" "refresh_tokens" {
  project        = var.project_id
  name           = local.redis_instance_name
  display_name   = "Refresh token family state"
  region         = var.region
  tier           = "BASIC"
  memory_size_gb = var.redis_memory_size_gb
  redis_version  = var.redis_version

  authorized_network = google_compute_network.main.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  labels = local.labels

  depends_on = [
    google_project_service.required["redis.googleapis.com"],
    google_service_networking_connection.private_vpc_connection,
  ]
}
