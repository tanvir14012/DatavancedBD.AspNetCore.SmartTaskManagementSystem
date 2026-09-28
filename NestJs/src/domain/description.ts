/** Mirrors the local clarity pass used when no approved AI provider is configured. */
export function improveDescriptionLocally(text: string): string {
  const steps = text
    .split(/[\r\n.;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  if (steps.length === 0) return 'Task description is empty.';
  if (steps.length === 1) return `Task: ${steps[0]}`;
  return `- ${steps.join('\n- ')}`;
}
