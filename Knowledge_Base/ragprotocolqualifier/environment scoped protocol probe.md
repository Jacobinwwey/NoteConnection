# Environment Scoped Protocol Probe
Environment scoped protocol probe records that the transport protocol is HTTP/2 for staging and gRPC for production.

## Environment Transport Protocols
The transport protocol is HTTP/2 in the staging environment.

Context paragraph keeps both environment-specific protocols in one scoped section.

The transport protocol is gRPC in the production environment.
Operators should not collapse staging and production protocol records into one single transport protocol.
