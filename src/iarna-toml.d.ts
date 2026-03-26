declare module '@iarna/toml' {
  export type JsonMap = Record<string, unknown>;

  export function parse(content: string): unknown;
  export function stringify(value: JsonMap): string;
}
