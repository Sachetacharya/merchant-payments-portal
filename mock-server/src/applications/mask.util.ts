export function maskValue(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }
  const visible = value.slice(-4);
  return `${'•'.repeat(Math.max(value.length - 4, 0))}${visible}`;
}
