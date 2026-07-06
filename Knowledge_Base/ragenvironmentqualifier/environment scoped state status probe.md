# Environment Scoped State Status Probe
Environment scoped state status probe validates that the migration gate status is enabled in the staging environment while production status facts remain environment-qualified evidence rather than a conflict.

## Gate Status By Environment
The migration gate status is enabled in the staging environment.

Operators should preserve the environment label when comparing deployment records.

The migration gate status is disabled in the production environment.
