# Format Conflict Probe

Format conflict probe records competing payload format values: JSON and YAML.

## Payload Contract

The payload format is JSON in the release contract.

Context paragraph keeps the format conflict inside one scoped section.

The payload format is YAML in the rollback contract.

Operators must resolve which payload format is active before release.
