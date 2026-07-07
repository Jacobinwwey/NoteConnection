# Service Port Conflict Probe
Service port conflict probe records competing listener port values: 443 and 8443.

## Listener Port
The service port is 443 in the release manifest.

Context paragraph keeps the service port conflict inside one scoped section.

The service port is 8443 in the rollback manifest.
Operators must resolve which service port is active before release.
