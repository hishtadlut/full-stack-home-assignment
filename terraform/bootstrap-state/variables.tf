variable "project_id" {
  description = "GCP project ID that owns the Terraform state bucket."
  type        = string
}

variable "region" {
  description = "Terraform state bucket location."
  type        = string
  default     = "me-west1"
}

variable "state_bucket_name" {
  description = "Name of the GCS bucket for Terraform state."
  type        = string
  default     = null
  nullable    = true
}
