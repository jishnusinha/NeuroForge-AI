import React, { useState, useMemo } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Table, 
  LineChart as LineChartIcon,
  AlertCircle 
} from 'lucide-react';
import { useLabStore } from '../../store/useLabStore';

export default function UnifiedChart({
  title,
  unit = '',
  trainSeries = [], // [{ epoch, value }]
  valSeries = [],   // [{ epoch, value }]
  height = 140,
  minVal = null,
  maxVal = null,
  colorTrain = '#46D7F2', // Cyan (run metric, distinct from class colors)
  colorVal = '#3CD5AA',   // Emerald
  chartId = 'chart-default',
}) {
  const { linkedCursor, setLinkedCursor, setSelectedContext } = useLabStore();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showTableView, setShowTableView] = useState(false);

  // Combine and sort epochs
  const allEpochs = useMemo(() => {
    const set = new Set();
    trainSeries.forEach((p) => set.add(p.epoch));
    valSeries.forEach((p) => set.add(p.epoch));
    return Array.from(set).sort((a, b) => a - b);
  }, [trainSeries, valSeries]);

  // Handle zoom slice
  const displayedEpochs = useMemo(() => {
    if (zoomLevel <= 1 || allEpochs.length <= 10) return allEpochs;
    const count = Math.max(5, Math.floor(allEpochs.length / zoomLevel));
    return allEpochs.slice(-count);
  }, [allEpochs, zoomLevel]);

  // Lookup maps for fast value matching
  const trainMap = useMemo(() => new Map(trainSeries.map((p) => [p.epoch, p.value])), [trainSeries]);
  const valMap = useMemo(() => new Map(valSeries.map((p) => [p.epoch, p.value])), [valSeries]);

  // Determine scale bounds (ignoring null/undefined)
  const { effectiveMin, effectiveMax } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    displayedEpochs.forEach((ep) => {
      const tv = trainMap.get(ep);
      const vv = valMap.get(ep);
      if (typeof tv === 'number' && !Number.isNaN(tv)) {
        if (tv < min) min = tv;
        if (tv > max) max = tv;
      }
      if (typeof vv === 'number' && !Number.isNaN(vv)) {
        if (vv < min) min = vv;
        if (vv > max) max = vv;
      }
    });
    if (min === Infinity) { min = 0; max = 1; }
    if (min === max) { min = Math.max(0, min - 0.5); max = max + 0.5; }
    return {
      effectiveMin: minVal !== null ? minVal : min,
      effectiveMax: maxVal !== null ? maxVal : max,
    };
  }, [displayedEpochs, trainMap, valMap, minVal, maxVal]);

  const range = effectiveMax - effectiveMin || 1;
  const paddingX = 36;
  const paddingY = 24;
  const width = 360;
  const chartInnerWidth = width - paddingX * 2;
  const chartInnerHeight = height - paddingY * 2;

  // Coordinate projections
  const getX = (index) => {
    if (displayedEpochs.length <= 1) return paddingX + chartInnerWidth / 2;
    return paddingX + (index / (displayedEpochs.length - 1)) * chartInnerWidth;
  };

  const getY = (val) => {
    if (val === null || val === undefined || Number.isNaN(val)) return null;
    const clamped = Math.max(effectiveMin, Math.min(effectiveMax, val));
    return paddingY + (1 - (clamped - effectiveMin) / range) * chartInnerHeight;
  };

  // Build SVG path segments with gaps for missing values
  const buildPath = (map) => {
    let d = '';
    let inSegment = false;
    displayedEpochs.forEach((ep, idx) => {
      const val = map.get(ep);
      const y = getY(val);
      if (y !== null) {
        const x = getX(idx);
        if (!inSegment) {
          d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
          inSegment = true;
        } else {
          d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        }
      } else {
        inSegment = false;
      }
    });
    return d;
  };

  const trainPath = buildPath(trainMap);
  const valPath = buildPath(valMap);

  // Active hover/scrub item
  const activeEpoch = linkedCursor?.epoch;

  const handlePointerHover = (ep) => {
    const tv = trainMap.get(ep);
    const vv = valMap.get(ep);
    setLinkedCursor({ epoch: ep, source: chartId });
    setSelectedContext({
      type: 'metric',
      data: {
        name: title,
        epoch: ep,
        trainValue: tv,
        valValue: vv,
        unit,
      },
    });
  };

  const latestTrain = trainSeries.length > 0 ? trainSeries[trainSeries.length - 1].value : null;
  const latestVal = valSeries.length > 0 ? valSeries[valSeries.length - 1].value : null;

  return (
    <div 
      className="p-3.5 rounded-xl bg-obsidian border border-white/5 flex flex-col justify-between font-mono text-xs select-none relative"
      role="region"
      aria-label={`${title} chart`}
    >
      {/* Header and Controls */}
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <LineChartIcon className="w-3.5 h-3.5 text-plasma-cyan" />
          <span className="font-semibold text-white">{title}</span>
          {unit && <span className="text-[10px] text-text-muted">({unit})</span>}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(4, z + 0.5))}
            className="p-1 rounded text-text-muted hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
            className="p-1 rounded text-text-muted hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          {zoomLevel > 1 && (
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="p-1 rounded text-text-muted hover:text-white hover:bg-white/10 transition-colors"
              title="Reset Zoom"
              aria-label="Reset Zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowTableView(!showTableView)}
            className={`p-1 rounded transition-colors ${
              showTableView ? 'bg-plasma-cyan/20 text-plasma-cyan' : 'text-text-muted hover:text-white hover:bg-white/10'
            }`}
            title="Toggle accessible table view"
            aria-label="Toggle accessible table view"
            aria-pressed={showTableView}
          >
            <Table className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Legend & Current Values */}
      <div className="flex items-center justify-between py-1.5 text-[11px] text-text-muted">
        <div className="flex items-center gap-3">
          {/* Training Legend (Solid circle marker) */}
          <div className="flex items-center gap-1.5">
            <svg width="14" height="10" className="inline-block">
              <line x1="0" y1="5" x2="14" y2="5" stroke={colorTrain} strokeWidth="2" />
              <circle cx="7" cy="5" r="2.5" fill={colorTrain} />
            </svg>
            <span className="text-text-muted">Train (●):</span>
            <span className="font-semibold text-white">
              {latestTrain !== null && latestTrain !== undefined ? Number(latestTrain).toFixed(3) : '—'}
            </span>
          </div>

          {/* Validation Legend (Dashed triangle marker) */}
          <div className="flex items-center gap-1.5">
            <svg width="14" height="10" className="inline-block">
              <line x1="0" y1="5" x2="14" y2="5" stroke={colorVal} strokeWidth="2" strokeDasharray="3 2" />
              <polygon points="7,2 10,8 4,8" fill={colorVal} />
            </svg>
            <span className="text-text-muted">Val (▲):</span>
            <span className="font-semibold text-quantum-mint">
              {latestVal !== null && latestVal !== undefined ? Number(latestVal).toFixed(3) : 'Not measured'}
            </span>
          </div>
        </div>

        {zoomLevel > 1 && (
          <span className="text-[10px] text-signal-amber">Zoom: {zoomLevel}x</span>
        )}
      </div>

      {/* Content: Chart vs Table */}
      {showTableView ? (
        <div className="mt-2 max-h-36 overflow-y-auto border border-white/5 rounded-lg">
          <table className="w-full text-left text-[11px] font-mono">
            <caption className="sr-only">{title}: recorded training and validation values by epoch</caption>
            <thead className="bg-deep-space text-text-muted sticky top-0 border-b border-white/10">
              <tr>
                <th scope="col" className="p-1.5">Epoch</th>
                <th scope="col" className="p-1.5">Train</th>
                <th scope="col" className="p-1.5">Validation</th>
              </tr>
            </thead>
            <tbody>
              {displayedEpochs.length === 0 ? (
                <tr>
                  <td colSpan="3" className="p-2 text-center text-text-muted">No measurements recorded</td>
                </tr>
              ) : (
                displayedEpochs.map((ep) => {
                  const tv = trainMap.get(ep);
                  const vv = valMap.get(ep);
                  return (
                    <tr key={ep} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-1.5 text-white">{ep}</td>
                      <td className="p-1.5 text-plasma-cyan">
                        {tv !== undefined && tv !== null ? Number(tv).toFixed(4) : '—'}
                      </td>
                      <td className="p-1.5 text-quantum-mint">
                        {vv !== undefined && vv !== null ? Number(vv).toFixed(4) : 'Not measured'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : displayedEpochs.length === 0 ? (
        <div className="h-28 flex flex-col items-center justify-center text-center text-text-muted/60 gap-1">
          <AlertCircle className="w-5 h-5 text-white/20" />
          <span className="text-[11px]">No measurements recorded</span>
          <span className="text-[10px]">Start training to capture real-time metric trajectory</span>
        </div>
      ) : (
        <div className="relative mt-1">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full overflow-visible"
            role="img"
            aria-label={`${title} trajectory`}
          >
            {/* Grid & Axis Ticks */}
            <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" />
            <line x1={paddingX} y1={paddingY + chartInnerHeight / 2} x2={width - paddingX} y2={paddingY + chartInnerHeight / 2} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" />
            <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="rgba(255,255,255,0.15)" />

            {/* Y axis labels */}
            <text x={paddingX - 6} y={paddingY + 4} fill="#9EACC4" fontSize="9" textAnchor="end">{effectiveMax.toFixed(2)}</text>
            <text x={paddingX - 6} y={height - paddingY} fill="#9EACC4" fontSize="9" textAnchor="end">{effectiveMin.toFixed(2)}</text>

            {/* Paths */}
            {trainPath && (
              <path
                d={trainPath}
                fill="none"
                stroke={colorTrain}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {valPath && (
              <path
                d={valPath}
                fill="none"
                stroke={colorVal}
                strokeWidth="2"
                strokeDasharray="4 3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Points / markers with linked hover */}
            {displayedEpochs.map((ep, idx) => {
              const tv = trainMap.get(ep);
              const vv = valMap.get(ep);
              const x = getX(idx);
              const yTrain = getY(tv);
              const yVal = getY(vv);
              const isSelected = activeEpoch === ep;

              return (
                <g 
                  key={ep}
                  className="cursor-pointer group"
                  onMouseEnter={() => handlePointerHover(ep)}
                  tabIndex="0"
                  role="button"
                  aria-label={`Epoch ${ep}: Train ${tv ?? 'n/a'}, Val ${vv ?? 'n/a'}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handlePointerHover(ep);
                    }
                  }}
                >
                  {/* Linked cursor vertical guideline */}
                  {isSelected && (
                    <line
                      x1={x}
                      y1={paddingY}
                      x2={x}
                      y2={height - paddingY}
                      stroke="#F3B65E"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                  )}

                  {/* Train point: circle */}
                  {yTrain !== null && (
                    <circle
                      cx={x}
                      cy={yTrain}
                      r={isSelected ? 4.5 : 2.5}
                      fill={colorTrain}
                      stroke="#080D18"
                      strokeWidth="1.5"
                      className="transition-all"
                    />
                  )}

                  {/* Val point: triangle */}
                  {yVal !== null && (
                    <polygon
                      points={`${x},${yVal - 3.5} ${x + 3.5},${yVal + 3.5} ${x - 3.5},${yVal + 3.5}`}
                      fill={colorVal}
                      stroke="#080D18"
                      strokeWidth="1.5"
                      className="transition-all"
                    />
                  )}
                </g>
              );
            })}

            {/* X Axis First and Last Epoch */}
            {displayedEpochs.length > 0 && (
              <>
                <text x={getX(0)} y={height - 8} fill="#9EACC4" fontSize="9" textAnchor="start">
                  Ep {displayedEpochs[0]}
                </text>
                <text x={getX(displayedEpochs.length - 1)} y={height - 8} fill="#9EACC4" fontSize="9" textAnchor="end">
                  Ep {displayedEpochs[displayedEpochs.length - 1]}
                </text>
              </>
            )}
          </svg>
        </div>
      )}
    </div>
  );
}
