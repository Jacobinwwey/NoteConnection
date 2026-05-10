# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

This project does **not** use a traditional ORM. The knowledge graph persistence layer uses embedded sqlite via `better-sqlite3` with a custom store abstraction in `src/learning/store.ts`. All database access goes through the `KnowledgeGraphStore` interface.

Two implementations exist and both conform to the same interface:

| Implementation | Kind | Default? |
|---------------|------|----------|
| `SqliteKnowledgeGraphStore` | `sqlite` | Yes |
| `FileBackedKnowledgeGraphStore` | `file` | No (fallback) |

Default kind constant: `DEFAULT_KNOWLEDGE_GRAPH_STORE_KIND = 'sqlite'` (`src/learning/store.ts:59`).

---

## Query Patterns

- **No raw SQL in application code**: All database access goes through store methods (`loadSnapshot`, `saveSnapshot`, `reload`).
- **Graph traversal is in-memory**: The store is a persistence layer — load the snapshot, then query/transform in-memory.
- **Query backend separation**: `src/learning/queryBackend.ts` provides `local_hybrid` (keyword + title_match + vector_ann + relation bonuses) and `keyword_only` (lexical fallback). Selected per-request via `queryBackend` field in `POST /api/knowledge/query`.
- **Request-level override supported**: Pass `queryBackend` in the query body to select backend without mutating global config.

---

## Migrations

- **No formal migration framework**: Schema is created idempotently in store class initialization using `CREATE TABLE IF NOT EXISTS`.
- **Schema contract**: `KnowledgeGraphSnapshot` interface in `src/learning/store.ts:30` is the de facto schema.
- **Versioned filename**: `runtime_data/knowledge_graph_store.v1.sqlite` — bump the version suffix on breaking schema changes.
- **Backwards compatibility**: File-backed store remains available as a fallback. `FoundationReadinessStoreType` tracks `'none' | 'file' | 'sqlite'`.

---

## Naming Conventions

- Store methods: `load*`, `save*`, `reload` — consistent across both implementations.
- Store kind constants: `UPPER_SNAKE_CASE` (`FILE_KNOWLEDGE_GRAPH_STORE_KIND`, `SQLITE_KNOWLEDGE_GRAPH_STORE_KIND`).
- Database file: `knowledge_graph_store.v1.sqlite` under `runtime_data/`.

---

## Common Mistakes

- Bypassing the store interface with direct `better-sqlite3` calls — all sqlite ops must go through `KnowledgeGraphStore`.
- Ad-hoc file I/O (`fs.writeFile`) instead of using `FileBackedKnowledgeGraphStore`.
- Changing the snapshot schema without updating `KnowledgeGraphSnapshot` type — that type IS the schema contract.
