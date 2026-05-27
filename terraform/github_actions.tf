resource "google_iam_workload_identity_pool" "github" {
  count = var.github_repository == null ? 0 : 1

  project                   = var.project_id
  workload_identity_pool_id = local.github_pool_id
  display_name              = "Task Manager GitHub Actions"
  description               = "OIDC pool for production deployments from GitHub Actions"

  depends_on = [google_project_service.required["iamcredentials.googleapis.com"]]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  count = var.github_repository == null ? 0 : 1

  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github[0].workload_identity_pool_id
  workload_identity_pool_provider_id = local.github_provider_id
  display_name                       = "GitHub OIDC"
  attribute_condition                = "assertion.repository == '${var.github_repository}'"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_wif_user" {
  count = var.github_repository == null ? 0 : 1

  service_account_id = google_service_account.github_deployer[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github[0].name}/attribute.repository/${var.github_repository}"
}
