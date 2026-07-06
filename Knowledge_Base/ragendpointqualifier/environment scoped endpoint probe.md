# Environment Scoped Endpoint Probe
Environment scoped endpoint probe records that the webhook endpoint is /api/staging/hooks for staging and /api/prod/hooks for production.

## Environment Routes
The webhook endpoint is /api/staging/hooks in the staging environment.

Context paragraph keeps both environment-specific endpoints in one scoped section.

The webhook endpoint is /api/prod/hooks in the production environment.
Operators should not collapse staging and production endpoint records into one single route.
