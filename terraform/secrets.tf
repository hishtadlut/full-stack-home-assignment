resource "google_secret_manager_secret" "managed" {
  for_each = local.secret_ids

  project   = var.project_id
  secret_id = each.key
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required["secretmanager.googleapis.com"]]
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "google_secret_manager_secret_version" "database_url" {
  secret = google_secret_manager_secret.managed["DATABASE_URL"].id
  secret_data = format(
    "postgresql://%s:%s@%s:5432/%s?schema=public",
    var.database_user,
    random_password.database.result,
    google_sql_database_instance.postgres.private_ip_address,
    google_sql_database.app.name,
  )

  depends_on = [google_sql_user.app]
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.managed["JWT_SECRET"].id
  secret_data = random_password.jwt_secret.result
}

resource "google_secret_manager_secret_version" "gemini_api_key" {
  count = var.gemini_api_key == null ? 0 : 1

  secret      = google_secret_manager_secret.managed["GEMINI_API_KEY"].id
  secret_data = var.gemini_api_key
}
