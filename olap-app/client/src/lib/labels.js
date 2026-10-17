const DIRECTION_LABELS = {
  pickup: 'Pickup',
  dropoff: 'Drop-off',
  combined: 'Combined',
};

// Anything not listed falls back to the raw value with a capital letter.
export function directionLabel(direction) {
  if (!direction) return '';
  return DIRECTION_LABELS[direction] ?? direction.charAt(0).toUpperCase() + direction.slice(1);
}
