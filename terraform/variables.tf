variable "project_id" {
  description = "GCP project ID for the production deployment."
  type        = string
}

variable "region" {
  description = "Primary Google Cloud region. me-west1 is Tel Aviv, Israel."
  type        = string
  default     = "me-west1"
}

variable "name_prefix" {
  description = "Prefix for production resources."
  type        = string
  default     = "task-manager-prod"
}

variable "domain_name" {
  description = "Production domain served by the HTTPS load balancer."
  type        = string
}

variable "additional_cors_origins" {
  description = "Optional extra browser origins allowed to call the API. The production domain is always included."
  type        = list(string)
  default     = []
}

variable "labels" {
  description = "Common labels applied to supported resources."
  type        = map(string)
  default = {
    app         = "task-manager"
    environment = "prod"
    managed_by  = "terraform"
  }
}

variable "deletion_protection" {
  description = "Protect stateful and Cloud Run resources from accidental deletion."
  type        = bool
  default     = true
}

variable "artifact_repository_id" {
  description = "Artifact Registry Docker repository ID."
  type        = string
  default     = "task-manager"
}

variable "backend_image" {
  description = "Backend API image. Replace the placeholder with an Artifact Registry image digest before production apply."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "frontend_image" {
  description = "Frontend SPA image. Replace the placeholder with an Artifact Registry image digest before production apply."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "container_port" {
  description = "Container port used by both Cloud Run services."
  type        = number
  default     = 8080
}

variable "cloud_run_ingress" {
  description = "Cloud Run ingress mode. The default allows only load balancer and internal ingress."
  type        = string
  default     = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
}

variable "api_min_instances" {
  description = "Keep one API instance warm."
  type        = number
  default     = 1
}

variable "api_max_instances" {
  description = "Maximum API instances. Keep at 1 while realtime WebSocket subscriptions are stored in process memory."
  type        = number
  default     = 1
}

variable "web_min_instances" {
  description = "Keep one frontend instance warm."
  type        = number
  default     = 1
}

variable "web_max_instances" {
  description = "Small burst cap for the frontend service."
  type        = number
  default     = 2
}

variable "api_concurrency" {
  description = "Cloud Run request concurrency for the API service."
  type        = number
  default     = 80
}

variable "web_concurrency" {
  description = "Cloud Run request concurrency for the frontend service."
  type        = number
  default     = 80
}

variable "api_timeout" {
  description = "API request timeout. WebSocket connections are long-running HTTP requests on Cloud Run."
  type        = string
  default     = "3600s"
}

variable "web_timeout" {
  description = "Frontend request timeout."
  type        = string
  default     = "30s"
}

variable "cloud_run_cpu" {
  description = "CPU limit for Cloud Run containers."
  type        = string
  default     = "1000m"
}

variable "cloud_run_memory" {
  description = "Memory limit for Cloud Run containers."
  type        = string
  default     = "512Mi"
}

variable "vpc_cidr" {
  description = "Subnet CIDR used by Cloud Run Direct VPC egress."
  type        = string
  default     = "10.40.0.0/24"
}

variable "private_service_access_prefix_length" {
  description = "Reserved address range prefix length for private service access."
  type        = number
  default     = 16
}

variable "database_version" {
  description = "Cloud SQL database version."
  type        = string
  default     = "POSTGRES_15"
}

variable "database_name" {
  description = "Application database name."
  type        = string
  default     = "taskmanager"
}

variable "database_user" {
  description = "Application database user."
  type        = string
  default     = "taskmanager_app"
}

variable "cloud_sql_tier" {
  description = "Small Cloud SQL machine tier for the example production project."
  type        = string
  default     = "db-f1-micro"
}

variable "cloud_sql_disk_size_gb" {
  description = "Cloud SQL SSD disk size in GB."
  type        = number
  default     = 10
}

variable "cloud_sql_backup_start_time" {
  description = "UTC backup start time for Cloud SQL."
  type        = string
  default     = "02:00"
}

variable "gemini_api_key" {
  description = "Optional Gemini API key. If null, the assistant routes remain deployed but provider calls fail until a secret version is added."
  type        = string
  default     = null
  sensitive   = true
  nullable    = true
}

variable "armor_rate_limit_count" {
  description = "Global Cloud Armor request limit per IP per interval."
  type        = number
  default     = 300
}

variable "armor_rate_limit_interval_sec" {
  description = "Global Cloud Armor rate limit interval."
  type        = number
  default     = 60
}

variable "auth_rate_limit_count" {
  description = "Cloud Armor request limit for login and register paths per IP per interval."
  type        = number
  default     = 30
}

variable "auth_rate_limit_interval_sec" {
  description = "Cloud Armor auth rate limit interval."
  type        = number
  default     = 60
}

variable "enable_observability" {
  description = "Create uptime check and log retention settings."
  type        = bool
  default     = true
}

variable "alert_email" {
  description = "Optional email notification channel for uptime alerts."
  type        = string
  default     = null
  nullable    = true
}

variable "github_repository" {
  description = "Optional GitHub repository allowed to deploy, in owner/repo form."
  type        = string
  default     = null
  nullable    = true
}
