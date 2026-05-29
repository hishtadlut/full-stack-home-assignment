locals {
  labels = merge(var.labels, {
    app         = "task-manager"
    environment = "prod"
    managed_by  = "terraform"
  })

  network_name        = "${var.name_prefix}-vpc"
  subnet_name         = "${var.name_prefix}-serverless"
  api_service_name    = "${var.name_prefix}-api"
  web_service_name    = "${var.name_prefix}-web"
  migrate_job_name    = "${var.name_prefix}-migrate"
  sql_instance_name   = "${var.name_prefix}-postgres"
  redis_instance_name = "${var.name_prefix}-refresh-tokens"
  runtime_sa_id       = "${var.name_prefix}-run"
  github_pool_id      = "${var.name_prefix}-github"
  github_provider_id  = "github-oidc"
  github_sa_id        = "task-manager-gh-deploy"

  secret_ids = toset([
    "DATABASE_URL",
    "JWT_SECRET",
    "GEMINI_API_KEY",
  ])

  cors_origins = concat(["https://${var.domain_name}"], var.additional_cors_origins)

  api_secret_env = merge(
    {
      DATABASE_URL = "DATABASE_URL"
      JWT_SECRET   = "JWT_SECRET"
    },
    var.gemini_api_key == null ? {} : {
      GEMINI_API_KEY = "GEMINI_API_KEY"
    }
  )

  backend_image_target  = "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_repository_id}/backend:<git-sha>"
  frontend_image_target = "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_repository_id}/frontend:<git-sha>"
}
