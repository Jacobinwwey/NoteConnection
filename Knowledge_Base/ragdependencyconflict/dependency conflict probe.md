# Dependency Conflict Probe
Dependency conflict probe records competing storage dependency values: SQLite and PostgreSQL.

## Storage Dependency
The storage dependency is SQLite in the release manifest.

Context paragraph keeps the dependency conflict inside one scoped section.

The storage dependency is PostgreSQL in the rollback manifest.
Operators must resolve which storage dependency is active before release.
