"use client";

import { useId, useState } from "react";

/**
 * Two single-series magnitude charts for the institution analytics tab.
 *
 * Single series throughout, so there is no categorical palette to encode
 * identity with: one accent hue carries magnitude, and the axes stay
 * recessive. Values are read from a tooltip rather than stamped on every
 * mark, with the peak direct-labelled so the shape has an anchor.
 */

const ACCENT = "#60a5fa";
const ACCENT_DIM = "#1e3a5f";
const SURFACE_GAP = 2;

export interface MonthPoint {
  month: string;
  label: string;
  issued: number;
}

export function IssuanceBarChart({ data }: { data: MonthPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const titleId = useId();

  const max = Math.max(1, ...data.map((point) => point.issued));
  const peakIndex = data.reduce(
    (best, point, index) => (point.issued > data[best].issued ? index : best),
    0
  );

  const width = 320;
  const height = 132;
  const baseline = height - 22;
  const plotTop = 16;
  const slot = width / Math.max(data.length, 1);
  const barWidth = Math.max(10, slot - SURFACE_GAP * 4);

  if (data.every((point) => point.issued === 0)) {
    return (
      <p className="text-xs text-zinc-500 py-10 text-center">
        No certificates issued in the last six months.
      </p>
    );
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>Certificates issued per month over the last six months</title>

        {/* Recessive baseline only — no gridlines competing with six bars. */}
        <line x1="0" y1={baseline} x2={width} y2={baseline} stroke="#27272a" strokeWidth="1" />

        {data.map((point, index) => {
          const barHeight = point.issued === 0 ? 0 : ((baseline - plotTop) * point.issued) / max;
          const x = index * slot + (slot - barWidth) / 2;
          const y = baseline - barHeight;
          const active = hovered === index;

          return (
            <g key={point.month}>
              {/* Full-height hit area so small bars stay easy to hover. */}
              <rect
                x={index * slot}
                y={0}
                width={slot}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              />
              {barHeight > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  fill={active ? "#93c5fd" : ACCENT}
                  className="transition-[fill] duration-150"
                  pointerEvents="none"
                />
              )}
              {barHeight === 0 && (
                <rect x={x} y={baseline - 2} width={barWidth} height="2" rx="1" fill={ACCENT_DIM} pointerEvents="none" />
              )}
              {index === peakIndex && point.issued > 0 && !active && (
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="fill-zinc-300"
                  fontSize="9"
                  fontWeight="600"
                  pointerEvents="none"
                >
                  {point.issued}
                </text>
              )}
              {active && (
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="fill-white"
                  fontSize="9"
                  fontWeight="700"
                  pointerEvents="none"
                >
                  {point.issued}
                </text>
              )}
              <text
                x={index * slot + slot / 2}
                y={height - 6}
                textAnchor="middle"
                className={active ? "fill-zinc-300" : "fill-zinc-500"}
                fontSize="9"
                pointerEvents="none"
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Table view keeps the numbers reachable without hovering. */}
      <details className="mt-2">
        <summary className="text-[11px] text-zinc-500 cursor-pointer hover:text-zinc-300">
          View as table
        </summary>
        <table className="w-full mt-2 text-[11px]">
          <tbody>
            {data.map((point) => (
              <tr key={point.month} className="border-t border-zinc-800">
                <td className="py-1 text-zinc-400">{point.label}</td>
                <td className="py-1 text-right font-mono text-zinc-200">{point.issued}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export interface DegreeSlice {
  degreeType: string;
  count: number;
}

export function DegreeMixBars({ data }: { data: DegreeSlice[] }) {
  if (!data.length) {
    return <p className="text-xs text-zinc-500 py-10 text-center">Nothing issued yet.</p>;
  }

  const max = Math.max(...data.map((slice) => slice.count));
  const total = data.reduce((sum, slice) => sum + slice.count, 0);

  return (
    <ul className="space-y-2.5">
      {data.slice(0, 7).map((slice) => (
        <li key={slice.degreeType}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-[11px] text-zinc-300 truncate">{slice.degreeType}</span>
            <span className="text-[11px] font-mono text-zinc-400 flex-shrink-0">
              {slice.count}
              <span className="text-zinc-600"> · {Math.round((slice.count / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(slice.count / max) * 100}%`, backgroundColor: ACCENT }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
