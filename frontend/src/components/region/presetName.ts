import { useMeta } from "../../api/hooks";
import type { Bbox } from "../../api/types";
import { snapBbox } from "../../lib/geo";
import { useStore } from "../../state/store";

export function sameBox(a: Bbox | null, b: Bbox): boolean {
  return !!a && a.west === b.west && a.south === b.south && a.east === b.east && a.north === b.north;
}

// The name of the current box when it is a preset, for the region dropdown and the insights panel.
export function usePresetName(): string | null {
  const bbox = useStore((s) => s.bbox);
  const meta = useMeta();
  if (!bbox) return null;
  return meta.data?.presets.find((p) => sameBox(bbox, snapBbox(p.bbox)))?.name ?? null;
}
