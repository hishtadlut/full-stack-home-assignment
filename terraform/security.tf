resource "google_compute_security_policy" "edge" {
  project     = var.project_id
  name        = "${var.name_prefix}-edge-armor"
  description = "Baseline Cloud Armor policy for Task Manager production."
  type        = "CLOUD_ARMOR"

  adaptive_protection_config {
    layer_7_ddos_defense_config {
      enable = true
    }
  }

  rule {
    action      = "throttle"
    priority    = 900
    description = "Stricter IP throttle for login and registration endpoints."

    match {
      expr {
        expression = "request.path == '/api/auth/login' || request.path == '/api/auth/register'"
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"

      rate_limit_threshold {
        count        = var.auth_rate_limit_count
        interval_sec = var.auth_rate_limit_interval_sec
      }
    }
  }

  rule {
    action      = "throttle"
    priority    = 1000
    description = "Global IP throttle for all traffic."

    match {
      expr {
        expression = "true"
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"

      rate_limit_threshold {
        count        = var.armor_rate_limit_count
        interval_sec = var.armor_rate_limit_interval_sec
      }
    }
  }

  rule {
    action      = "allow"
    priority    = 2147483647
    description = "Default allow rule."

    match {
      versioned_expr = "SRC_IPS_V1"

      config {
        src_ip_ranges = ["*"]
      }
    }
  }

  depends_on = [google_project_service.required["compute.googleapis.com"]]
}
