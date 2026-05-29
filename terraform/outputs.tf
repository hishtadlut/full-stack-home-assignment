output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "domain_name" {
  value = var.domain_name
}

output "load_balancer_ip" {
  value = google_compute_global_address.https.address
}

output "api_service_name" {
  value = google_cloud_run_v2_service.api.name
}

output "web_service_name" {
  value = google_cloud_run_v2_service.web.name
}

output "migration_job_name" {
  value = google_cloud_run_v2_job.migrate.name
}

output "cloud_sql_instance" {
  value = google_sql_database_instance.postgres.name
}

output "cloud_sql_private_ip" {
  value = google_sql_database_instance.postgres.private_ip_address
}

output "redis_instance" {
  value = google_redis_instance.refresh_tokens.name
}

output "redis_host" {
  value = google_redis_instance.refresh_tokens.host
}

output "artifact_registry_repository" {
  value = google_artifact_registry_repository.containers.name
}

output "backend_image_target" {
  value = local.backend_image_target
}

output "frontend_image_target" {
  value = local.frontend_image_target
}

output "runtime_service_account" {
  value = google_service_account.runtime.email
}

output "github_workload_identity_provider" {
  value = var.github_repository == null ? null : google_iam_workload_identity_pool_provider.github[0].name
}

output "github_deployer_service_account" {
  value = var.github_repository == null ? null : google_service_account.github_deployer[0].email
}
