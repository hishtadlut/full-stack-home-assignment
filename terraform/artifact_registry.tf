resource "google_artifact_registry_repository" "containers" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repository_id
  description   = "Task Manager production container images"
  format        = "DOCKER"
  labels        = local.labels

  depends_on = [google_project_service.required["artifactregistry.googleapis.com"]]
}
