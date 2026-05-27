resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = local.runtime_sa_id
  display_name = "Task Manager production Cloud Run runtime"

  depends_on = [google_project_service.required["iam.googleapis.com"]]
}

resource "google_secret_manager_secret_iam_member" "runtime_secret_access" {
  for_each = google_secret_manager_secret.managed

  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_service_account" "github_deployer" {
  count = var.github_repository == null ? 0 : 1

  project      = var.project_id
  account_id   = local.github_sa_id
  display_name = "Task Manager GitHub Actions deployer"

  depends_on = [google_project_service.required["iam.googleapis.com"]]
}

resource "google_project_iam_member" "github_artifact_writer" {
  count = var.github_repository == null ? 0 : 1

  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_deployer[0].email}"
}

resource "google_project_iam_member" "github_run_admin" {
  count = var.github_repository == null ? 0 : 1

  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_deployer[0].email}"
}

resource "google_service_account_iam_member" "github_runtime_user" {
  count = var.github_repository == null ? 0 : 1

  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_deployer[0].email}"
}
