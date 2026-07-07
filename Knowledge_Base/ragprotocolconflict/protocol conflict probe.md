# Protocol Conflict Probe
Protocol conflict probe records competing transport protocol values: HTTP/1.1 and WebSocket.

## Transport Contract
The transport protocol is HTTP/1.1 in the release channel.

Context paragraph keeps the protocol conflict inside one scoped section.

The transport protocol is WebSocket in the rollback channel.
Operators must resolve which transport protocol is active before release.
