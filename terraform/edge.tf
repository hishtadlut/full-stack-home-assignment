resource "google_compute_global_address" "https" {
  project = var.project_id
  name    = "${var.name_prefix}-https-ip"

  depends_on = [google_project_service.required["compute.googleapis.com"]]
}

resource "random_id" "https_certificate" {
  byte_length = 4
  prefix      = "${var.name_prefix}-cert-"

  keepers = {
    domain_name = var.domain_name
  }
}

resource "google_compute_managed_ssl_certificate" "https" {
  project = var.project_id
  name    = random_id.https_certificate.hex

  managed {
    domains = [var.domain_name]
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [google_project_service.required["compute.googleapis.com"]]
}

resource "google_compute_region_network_endpoint_group" "api" {
  project               = var.project_id
  name                  = "${var.name_prefix}-api-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.api.name
  }
}

resource "google_compute_region_network_endpoint_group" "web" {
  project               = var.project_id
  name                  = "${var.name_prefix}-web-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.web.name
  }
}

resource "google_compute_backend_service" "api" {
  project               = var.project_id
  name                  = "${var.name_prefix}-api-backend"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = 3600
  security_policy       = google_compute_security_policy.edge.id

  backend {
    group = google_compute_region_network_endpoint_group.api.id
  }
}

resource "google_compute_backend_service" "web" {
  project               = var.project_id
  name                  = "${var.name_prefix}-web-backend"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = 30
  enable_cdn            = true
  security_policy       = google_compute_security_policy.edge.id

  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    default_ttl       = 3600
    max_ttl           = 86400
    client_ttl        = 3600
    negative_caching  = true
    serve_while_stale = 86400

    cache_key_policy {
      include_host         = true
      include_protocol     = true
      include_query_string = true
    }
  }

  backend {
    group = google_compute_region_network_endpoint_group.web.id
  }
}

resource "google_compute_url_map" "https" {
  project         = var.project_id
  name            = "${var.name_prefix}-url-map"
  default_service = google_compute_backend_service.web.id

  host_rule {
    hosts        = [var.domain_name]
    path_matcher = "main"
  }

  path_matcher {
    name            = "main"
    default_service = google_compute_backend_service.web.id

    path_rule {
      paths = [
        "/api",
        "/api/*",
        "/health",
        "/ws",
        "/ws/*",
      ]
      service = google_compute_backend_service.api.id
    }
  }
}

resource "google_compute_target_https_proxy" "https" {
  project          = var.project_id
  name             = "${var.name_prefix}-https-proxy"
  url_map          = google_compute_url_map.https.id
  ssl_certificates = [google_compute_managed_ssl_certificate.https.id]
}

resource "google_compute_global_forwarding_rule" "https" {
  project               = var.project_id
  name                  = "${var.name_prefix}-https-forwarding-rule"
  ip_address            = google_compute_global_address.https.id
  port_range            = "443"
  target                = google_compute_target_https_proxy.https.id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

resource "google_compute_url_map" "http_redirect" {
  project = var.project_id
  name    = "${var.name_prefix}-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "http_redirect" {
  project = var.project_id
  name    = "${var.name_prefix}-http-proxy"
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http_redirect" {
  project               = var.project_id
  name                  = "${var.name_prefix}-http-forwarding-rule"
  ip_address            = google_compute_global_address.https.id
  port_range            = "80"
  target                = google_compute_target_http_proxy.http_redirect.id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}
