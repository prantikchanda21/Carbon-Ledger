/** Maps grid carbon intensity (gCO2/kWh) to a colour: green for clean, red for fossil-heavy. */
export function carbonColor(ci: number): string {
  const t = Math.min(1, Math.max(0, (ci - 300) / 300));
  const hue = Math.round(150 * (1 - t));
  return `hsl(${hue}, 80%, 55%)`;
}
