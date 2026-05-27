# Terraform Production Deployment

This README is only for the Terraform deployment of the production GCP stack. The broader architecture notes live in `01-gcp-terraform-deployment-plan.md`.

## Target

| Item | Value |
|---|---|
| GCP project | `task-managment-497618` |
| Region | `me-west1` |
| Domain variable | `task-management.hishtadlut.link` |
| Terraform backend bucket | `task-managment-497618-task-manager-terraform-state` |
| Terraform backend prefix | `prod` |

## State Bootstrap

The remote Terraform state bucket is managed separately in `terraform/bootstrap-state`.

```powershell
terraform -chdir=terraform/bootstrap-state init
terraform -chdir=terraform/bootstrap-state apply `
  -var=project_id=task-managment-497618 `
  -var=region=me-west1
```

After bootstrap, initialize the main stack against that bucket:

```powershell
terraform -chdir=terraform init -reconfigure `
  -backend-config="bucket=task-managment-497618-task-manager-terraform-state" `
  -backend-config="prefix=prod"
```

## Required Variables

Pass these values through `terraform.tfvars`, `*.auto.tfvars`, or `TF_VAR_*` environment variables. Do not commit real secret values.

| Variable | Value |
|---|---|
| `project_id` | `task-managment-497618` |
| `region` | `me-west1` |
| `domain_name` | `task-management.hishtadlut.link` |
| `github_repository` | `hishtadlut/full-stack-home-assignment` |
| `backend_image` | Pushed backend Artifact Registry image digest |
| `frontend_image` | Pushed frontend Artifact Registry image digest |
| `gemini_api_key` | Optional sensitive value |

Example:

```powershell
$env:TF_VAR_project_id = "task-managment-497618"
$env:TF_VAR_region = "me-west1"
$env:TF_VAR_domain_name = "task-management.hishtadlut.link"
$env:TF_VAR_github_repository = "hishtadlut/full-stack-home-assignment"
$env:TF_VAR_backend_image = "me-west1-docker.pkg.dev/task-managment-497618/task-manager/backend@sha256:<digest>"
$env:TF_VAR_frontend_image = "me-west1-docker.pkg.dev/task-managment-497618/task-manager/frontend@sha256:<digest>"
$env:TF_VAR_gemini_api_key = $env:GEMINI_API_KEY
```

## Plan And Apply

```powershell
terraform -chdir=terraform plan -out=tfplan
terraform -chdir=terraform apply tfplan
```

For drift checks:

```powershell
terraform -chdir=terraform plan -detailed-exitcode
```

A clean stack returns:

```text
No changes. Your infrastructure matches the configuration.
```

## Terraform-Managed Resources

| File | Main resources |
|---|---|
| `terraform/apis.tf` | Required GCP APIs |
| `terraform/artifact_registry.tf` | Docker Artifact Registry repository |
| `terraform/network.tf` | VPC, subnet, private service access |
| `terraform/cloud_sql.tf` | Cloud SQL PostgreSQL instance, database, user |
| `terraform/secrets.tf` | Secret Manager secrets and versions |
| `terraform/iam.tf` | Runtime and deployer service accounts and IAM |
| `terraform/cloud_run.tf` | API service, web service, migration job |
| `terraform/edge.tf` | Static IP, managed SSL certificate, load balancer, URL maps, serverless NEGs |
| `terraform/security.tf` | Cloud Armor policy |
| `terraform/observability.tf` | Uptime check and optional alert channel |
| `terraform/github_actions.tf` | GitHub Workload Identity Federation |
| `terraform/outputs.tf` | Deployment outputs |

## External Step

Cloudflare DNS is not managed by Terraform in this repo. The `task-management` record must point to the Terraform `load_balancer_ip` output and stay DNS-only for Google-managed certificate validation.
