/** Join truthy class-name parts with spaces; drops false/null/undefined/'' so callers can inline conditionals. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
