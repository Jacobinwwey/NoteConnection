# Response Status Code Conflict Probe
Response status code conflict probe records competing HTTP response status values: 200 and 503.

## Endpoint Response Code
The response status code is 200 in the release manifest.

Context paragraph keeps the response status code conflict inside one scoped section.

The response status code is 503 in the rollback manifest.
Operators must resolve which response status code is active before release.
