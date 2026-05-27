resource "google_monitoring_uptime_check_config" "health" {
  count = var.enable_observability ? 1 : 0

  project      = var.project_id
  display_name = "${var.name_prefix} health"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"

    labels = {
      project_id = var.project_id
      host       = var.domain_name
    }
  }

  depends_on = [google_project_service.required["monitoring.googleapis.com"]]
}

resource "google_monitoring_notification_channel" "email" {
  count = var.enable_observability && var.alert_email != null ? 1 : 0

  project      = var.project_id
  display_name = "Task Manager production alerts"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }

  depends_on = [google_project_service.required["monitoring.googleapis.com"]]
}
