import {
  CANVAS_GRID,
  CANVAS_SNAP_THRESHOLD,
  type FieldConfig,
  type FieldLayout,
} from "./form-schema";

export interface GuideLine {
  orientation: "v" | "h";
  /** Position in canvas coords */
  pos: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: GuideLine[];
}

function edges(l: FieldLayout) {
  const h = l.h ?? 72;
  return {
    left: l.x,
    right: l.x + l.w,
    top: l.y,
    bottom: l.y + h,
    cx: l.x + l.w / 2,
    cy: l.y + h / 2,
  };
}

/** Snap position to grid + sibling edges/centers. Returns guides to draw. */
export function snapPosition(
  moving: FieldLayout,
  x: number,
  y: number,
  siblings: FieldLayout[],
  canvasWidth: number,
): SnapResult {
  const h = moving.h ?? 72;
  let nx = Math.round(x / CANVAS_GRID) * CANVAS_GRID;
  let ny = Math.round(y / CANVAS_GRID) * CANVAS_GRID;
  const guides: GuideLine[] = [];
  const t = CANVAS_SNAP_THRESHOLD;

  const self = {
    left: nx,
    right: nx + moving.w,
    top: ny,
    bottom: ny + h,
    cx: nx + moving.w / 2,
    cy: ny + h / 2,
  };

  // Canvas center
  const canvasCx = canvasWidth / 2;
  if (Math.abs(self.cx - canvasCx) <= t) {
    nx = canvasCx - moving.w / 2;
    guides.push({ orientation: "v", pos: canvasCx });
  }

  for (const s of siblings) {
    const e = edges(s);
    // Vertical aligns
    const vPairs: [number, number, () => void][] = [
      [self.left, e.left, () => { nx = e.left; }],
      [self.left, e.right, () => { nx = e.right; }],
      [self.right, e.left, () => { nx = e.left - moving.w; }],
      [self.right, e.right, () => { nx = e.right - moving.w; }],
      [self.cx, e.cx, () => { nx = e.cx - moving.w / 2; }],
    ];
    for (const [a, b, apply] of vPairs) {
      if (Math.abs(a - b) <= t) {
        apply();
        guides.push({ orientation: "v", pos: b });
        break;
      }
    }
    // Horizontal aligns
    const hPairs: [number, number, () => void][] = [
      [self.top, e.top, () => { ny = e.top; }],
      [self.top, e.bottom, () => { ny = e.bottom; }],
      [self.bottom, e.top, () => { ny = e.top - h; }],
      [self.bottom, e.bottom, () => { ny = e.bottom - h; }],
      [self.cy, e.cy, () => { ny = e.cy - h / 2; }],
    ];
    for (const [a, b, apply] of hPairs) {
      if (Math.abs(a - b) <= t) {
        apply();
        guides.push({ orientation: "h", pos: b });
        break;
      }
    }
  }

  return {
    x: Math.max(0, Math.round(nx)),
    y: Math.max(0, Math.round(ny)),
    guides,
  };
}

export function nextDropLayout(fields: FieldConfig[], type: string): FieldLayout {
  const maxZ = fields.reduce((m, f) => Math.max(m, f.layout?.z ?? 0), 0);
  const maxBottom = fields.reduce((m, f) => {
    if (!f.layout) return m;
    return Math.max(m, f.layout.y + (f.layout.h ?? 72));
  }, 24);
  const w = type === "heading" ? 360 : type === "image" ? 240 : 280;
  const h = type === "image" ? 160 : type === "heading" ? 48 : type === "textarea" ? 120 : 72;
  return { x: 40, y: maxBottom + 16, w, h, z: maxZ + 1 };
}

export function canvasHeight(fields: FieldConfig[], min = 480): number {
  const bottom = fields.reduce((m, f) => {
    if (!f.layout) return m;
    return Math.max(m, f.layout.y + (f.layout.h ?? 72));
  }, 0);
  return Math.max(min, bottom + 80);
}
