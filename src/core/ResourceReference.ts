/**
 * Shared, host-neutral reference normalization used by Graph and backend
 * identity generation. It intentionally has no Node or platform dependency so
 * the path-core bundle can execute in a browser VM and in Godot WebView.
 */
export function normalizeResourceReference(reference: string): string {
  if (typeof reference !== 'string') {
    throw new Error('Resource reference must be a string');
  }
  if (reference.includes('\0')) {
    throw new Error('Resource reference must not contain NUL characters');
  }
  return reference.normalize('NFC').replace(/\\/g, '/').toLowerCase();
}
