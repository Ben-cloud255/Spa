'use client';

import type { ReportDayRow } from '@/lib/types';

function money(n: number) {
  return new Intl.NumberFormat('en-TZ').format(n);
}

/**
 * An SVG bar chart, not CSS divs with percentage heights — those rely on a
 * flexbox/overflow layout chain that print rendering doesn't always resolve
 * correctly (that's what caused the chart to render blank in PDF exports).
 * SVG shapes are drawn with real coordinates, so they always render exactly
 * the same on screen and in print.
 */
export default function RevenueByDayChart({ data }: { data: ReportDayRow[] }) {
  if (data.length === 0) return null;

  const barWidth = 32;
  const gap = 16;
  const chartHeight = 140;
  const topPadding = 12;
  const labelSpace = 34;
  const leftPadding = 8;
  const width = data.length * (barWidth + gap) + gap + leftPadding;
  const height = topPadding + chartHeight + labelSpace;
  const max = Math.max(1, ...data.map((d) => d.revenueCollected));

  // Skip some labels once there are many bars, so dates stay legible instead
  // of overlapping into an unreadable smear.
  const labelEvery = data.length > 16 ? Math.ceil(data.length / 12) : 1;

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ minWidth: '100%' }}>
        {data.map((d, i) => {
          const barHeight = Math.max(3, (d.revenueCollected / max) * chartHeight);
          const x = leftPadding + gap + i * (barWidth + gap);
          const y = topPadding + (chartHeight - barHeight);
          const showLabel = i % labelEvery === 0 || i === data.length - 1;
          return (
            <g key={d.date}>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx={3} fill="#2f6b58" className="print-bar">
                <title>{money(d.revenueCollected)} TZS</title>
              </rect>
              {showLabel && (
                <text
                  x={x + barWidth / 2}
                  y={topPadding + chartHeight + 20}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#57534e"
                >
                  {new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
