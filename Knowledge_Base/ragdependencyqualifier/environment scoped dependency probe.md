# Environment Scoped Dependency Probe
Environment scoped dependency probe records that the storage dependency is SQLite for staging and PostgreSQL for production.

## Environment Dependencies
The storage dependency is SQLite in the staging environment.

Context paragraph keeps both environment-specific dependencies in one scoped section.

The storage dependency is PostgreSQL in the production environment.
Operators should not collapse staging and production dependency records into one single storage dependency.
