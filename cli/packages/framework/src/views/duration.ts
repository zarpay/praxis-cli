/** A wall-clock span, rendered for a summary line. */
export function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));

  if (total < 60) return `${total}s`;

  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  return `${minutes}m ${seconds}s`;
}
