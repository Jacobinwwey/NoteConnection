# Endpoint Conflict Probe
Endpoint conflict probe records competing webhook endpoint values: /api/v1/hooks and /api/v2/hooks.

## Webhook Routing
The webhook endpoint is /api/v1/hooks.

Context paragraph keeps the endpoint conflict inside one scoped section.

The webhook endpoint is /api/v2/hooks.
Operators must resolve which webhook endpoint is active before release.
