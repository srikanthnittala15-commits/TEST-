import { formatCompactINR } from "@/lib/format";

export type Series = { name: string; color: string; points: { x: number; y: number; label?: string }[] };

/** Simple responsive SVG line chart. Values are rupees; the x axis is labelled by `xLabel`. */
export function LineChart({ series, xLabel, caption }: { series: Series[]; xLabel: string; caption: string }) {
  const W = 480, H = 220, L = 64, R = 12, T = 12, B = 32;
  const pts = series.flatMap((s) => s.points);
  if (pts.length === 0) return null;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(0, ...ys), yMax = Math.max(...ys, 1);
  const sx = (x: number) => L + (xMax === xMin ? 0.5 : (x - xMin) / (xMax - xMin)) * (W - L - R);
  const sy = (y: number) => T + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - T - B);
  const ticks = [yMin, yMin + (yMax - yMin) / 2, yMax];
  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption} className="w-full h-auto">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} stroke="#e7e5e4" />
            <text x={L - 6} y={sy(t) + 4} textAnchor="end" fontSize="10" fill="#57534e">{formatCompactINR(t)}</text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.name}>
            <polyline fill="none" stroke={s.color} strokeWidth="2" points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")} />
            {s.points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2.5" fill={s.color} />)}
          </g>
        ))}
        {series[0].points.filter((_, i, a) => a.length <= 6 || i % Math.ceil(a.length / 6) === 0 || i === a.length - 1).map((p, i) => (
          <text key={i} x={sx(p.x)} y={H - 12} textAnchor="middle" fontSize="10" fill="#57534e">{p.label ?? p.x}</text>
        ))}
        <text x={(L + W - R) / 2} y={H - 1} textAnchor="middle" fontSize="9" fill="#78716c">{xLabel}</text>
      </svg>
      <figcaption className="flex flex-wrap gap-4 text-xs text-stone-700">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1">
            <span className="inline-block h-2 w-4 rounded" style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
