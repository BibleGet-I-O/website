/** A rectangle in the window, as getBoundingClientRect gives it. */
export type Box = { top: number; bottom: number; left: number; right: number };

/**
 * Where a card of `size` goes beside its mark (fixed coordinates): below it, else above it when it fits there and
 * not below; at the mark's left edge, moved to stay `margin` inside the window. One taller than the room on either
 * side stays below, moved up until its foot is inside the window (never above its top margin). Either one stays
 * inside the window when the mark has scrolled out of it.
 */
export function popupPosition(
  anchor: Box, size: { width: number; height: number }, viewport: { width: number; height: number }, gap = 6, margin = 8,
): { top: number; left: number } {
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - size.height;
  const fitsBelow = below + size.height <= viewport.height - margin;
  const fitsAbove = above >= margin;
  // Either way kept inside the window (a pinned card whose mark has scrolled out of it stays at its edge).
  const top = Math.max(margin, Math.min(fitsBelow || !fitsAbove ? below : above, viewport.height - margin - size.height));
  const left = Math.min(Math.max(anchor.left, margin), Math.max(margin, viewport.width - size.width - margin));
  return { top, left };
}
