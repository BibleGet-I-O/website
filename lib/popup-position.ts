/** A rectangle in the window, as getBoundingClientRect gives it. */
export type Box = { top: number; bottom: number; left: number; right: number };

/**
 * Where a card of `size` goes beside its mark (fixed coordinates): below it, else above it when it fits there and
 * not below; at the mark's left edge, moved to stay `margin` inside the window. One taller than the room on either
 * side stays below, moved up until its foot is inside the window (never above its top margin).
 */
export function popupPosition(
  anchor: Box, size: { width: number; height: number }, viewport: { width: number; height: number }, gap = 6, margin = 8,
): { top: number; left: number } {
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - size.height;
  const fitsBelow = below + size.height <= viewport.height - margin;
  const fitsAbove = above >= margin;
  const top = fitsBelow || !fitsAbove ? Math.max(margin, Math.min(below, viewport.height - margin - size.height)) : above;
  const left = Math.min(Math.max(anchor.left, margin), Math.max(margin, viewport.width - size.width - margin));
  return { top, left };
}
