# Environment Scoped Deployment Owner Probe
Environment scoped deployment owner probe validates that the deployment owner is Release Ops in the staging environment while production owner facts remain environment-qualified evidence rather than a conflict.

## Deployment Owner By Environment
The deployment owner is Release Ops in the staging environment.

Operators should preserve the environment label before comparing owner records.

The deployment owner is Rollback Team in the production environment.
