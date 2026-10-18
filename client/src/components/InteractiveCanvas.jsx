import React, { useRef, useEffect, useState, useCallback } from 'react';

export default function InteractiveCanvas({
  points = [],
  testPoints = [],
  algorithm = 'Logistic Regression',
  modelResult = null,
  isStale = false,
  activeTool = 'select',
  drawClass = 0,
  probePoint = null,
  onAddPoint,
  onUpdatePoint,
  onDeletePoint,
  onProbe,
  onCentroidDrag,
  kCentroids = [],
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Viewport transformation: scale and translation
  const [viewTransform, setViewTransform] = useState({ scale: 75, offsetX: 0, offsetY: 0 });
  const [draggedItem, setDraggedItem] = useState(null); // { type: 'point'|'centroid', index: number }
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Math coordinate conversion
  const mathToScreen = useCallback((mx, my, width, height) => {
    const cx = width / 2 + viewTransform.offsetX;
    const cy = height / 2 + viewTransform.offsetY;
    return {
      sx: cx + mx * viewTransform.scale,
      sy: cy - my * viewTransform.scale, // Invert Y for Cartesian axes
    };
  }, [viewTransform]);

  const screenToMath = useCallback((sx, sy, width, height) => {
    const cx = width / 2 + viewTransform.offsetX;
    const cy = height / 2 + viewTransform.offsetY;
    return {
      mx: Number(((sx - cx) / viewTransform.scale).toFixed(4)),
      my: Number(((cy - sy) / viewTransform.scale).toFixed(4)),
    };
  }, [viewTransform]);

  // Main Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = (canvas.width = canvas.parentElement.clientWidth);
    const height = (canvas.height = canvas.parentElement.clientHeight || 450);

    ctx.clearRect(0, 0, width, height);

    const { sx: originX, sy: originY } = mathToScreen(0, 0, width, height);

    // 1. Draw Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const step = viewTransform.scale;

    // Vertical grid
    for (let x = originX % step; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    // Horizontal grid
    for (let y = originY % step; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Draw Decision Surface / Background Heatmap (if applicable)
    if (modelResult && !isStale) {
      if (algorithm === 'Logistic Regression' && modelResult.predictProbability) {
        // Draw low-res probability grid for high performance
        const gridSize = 16;
        for (let gx = 0; gx < width; gx += gridSize) {
          for (let gy = 0; gy < height; gy += gridSize) {
            const { mx, my } = screenToMath(gx + gridSize / 2, gy + gridSize / 2, width, height);
            const prob = modelResult.predictProbability(mx, my);
            // Interpolate color: Class 0 (Cyan #46D7F2) vs Class 1 (Violet #A78BFA)
            if (prob > 0.5) {
              const alpha = Math.min(0.25, (prob - 0.5) * 0.5);
              ctx.fillStyle = `rgba(167, 139, 250, ${alpha})`;
            } else {
              const alpha = Math.min(0.25, (0.5 - prob) * 0.5);
              ctx.fillStyle = `rgba(70, 215, 242, ${alpha})`;
            }
            ctx.fillRect(gx, gy, gridSize, gridSize);
          }
        }
      } else if (algorithm === 'K-Means Clustering' && kCentroids.length > 0) {
        // Voronoi partitioning background
        const clusterColors = [
          'rgba(70, 215, 242, 0.08)',
          'rgba(167, 139, 250, 0.08)',
          'rgba(60, 213, 170, 0.08)',
          'rgba(243, 182, 94, 0.08)',
        ];
        const gridSize = 20;
        for (let gx = 0; gx < width; gx += gridSize) {
          for (let gy = 0; gy < height; gy += gridSize) {
            const { mx, my } = screenToMath(gx + gridSize / 2, gy + gridSize / 2, width, height);
            let minDist = Infinity;
            let closestCluster = 0;
            kCentroids.forEach((c, idx) => {
              const d = Math.hypot(mx - c.x, my - c.y);
              if (d < minDist) {
                minDist = d;
                closestCluster = idx;
              }
            });
            ctx.fillStyle = clusterColors[closestCluster % clusterColors.length];
            ctx.fillRect(gx, gy, gridSize, gridSize);
          }
        }
      }
    }

    // 3. Draw Coordinate Axes
    ctx.strokeStyle = 'rgba(158, 172, 196, 0.35)';
    ctx.lineWidth = 1.5;

    // X-Axis
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();

    // Y-Axis
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    // Axis Tick Labels
    ctx.fillStyle = '#9EACC4';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('0', originX + 4, originY + 12);
    ctx.fillText('+1', originX + viewTransform.scale - 6, originY + 14);
    ctx.fillText('-1', originX - viewTransform.scale - 8, originY + 14);
    ctx.fillText('+1', originX + 6, originY - viewTransform.scale + 4);
    ctx.fillText('-1', originX + 6, originY + viewTransform.scale + 4);

    // 4. Draw Linear Regression Fitted Line & Residuals
    if (algorithm === 'Linear Regression' && modelResult && modelResult.predict) {
      const { sx: x1, sy: y1 } = mathToScreen(-4, modelResult.predict(-4), width, height);
      const { sx: x2, sy: y2 } = mathToScreen(4, modelResult.predict(4), width, height);

      // Residual Drop-Lines
      ctx.strokeStyle = 'rgba(243, 182, 94, 0.35)';
      ctx.lineWidth = 1;
      points.forEach((p) => {
        const { sx: px, sy: py } = mathToScreen(p.x, p.y, width, height);
        const { sy: lineY } = mathToScreen(p.x, modelResult.predict(p.x), width, height);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, lineY);
        ctx.stroke();
      });

      // Regression Line
      ctx.strokeStyle = isStale ? 'rgba(70, 215, 242, 0.4)' : '#46D7F2';
      ctx.lineWidth = 2.5;
      if (isStale) ctx.setLineDash([6, 6]);
      else ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. Draw Logistic Regression Decision Boundary Line (w1*x1 + w2*x2 + b = 0)
    if (algorithm === 'Logistic Regression' && modelResult && modelResult.getBoundaryLine) {
      const bound = modelResult.getBoundaryLine(-4, 4);
      if (bound) {
        const { sx: x1, sy: y1 } = mathToScreen(-4, bound.yAtXMin, width, height);
        const { sx: x2, sy: y2 } = mathToScreen(4, bound.yAtXMax, width, height);

        ctx.strokeStyle = isStale ? 'rgba(243, 182, 94, 0.5)' : '#46D7F2';
        ctx.lineWidth = 2.5;
        if (isStale) ctx.setLineDash([6, 6]);
        else ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 6. Draw KNN Probe Rays & Query Point
    if (algorithm === 'K-Nearest Neighbors (KNN)' && probePoint) {
      const { sx: qx, sy: qy } = mathToScreen(probePoint.queryX, probePoint.queryY, width, height);

      // Rays to neighbors
      probePoint.neighbors.forEach((n) => {
        const { sx: nx, sy: ny } = mathToScreen(n.x, n.y, width, height);
        ctx.strokeStyle = n.label === 1 ? 'rgba(167, 139, 250, 0.6)' : 'rgba(70, 215, 242, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(qx, qy);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Target Query Marker
      ctx.beginPath();
      ctx.arc(qx, qy, 8, 0, Math.PI * 2);
      ctx.fillStyle = probePoint.predictedClass === 1 ? '#A78BFA' : '#46D7F2';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }

    // 7. Draw Data Points (All & Test)
    points.forEach((p) => {
      const { sx, sy } = mathToScreen(p.x, p.y, width, height);

      ctx.beginPath();
      ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);

      // Color by label or cluster
      if (algorithm === 'K-Means Clustering' && p.cluster !== undefined) {
        const clusterFills = ['#46D7F2', '#A78BFA', '#3CD5AA', '#F3B65E'];
        ctx.fillStyle = clusterFills[p.cluster % clusterFills.length];
      } else {
        ctx.fillStyle = p.label === 1 ? '#A78BFA' : '#46D7F2';
      }
      ctx.fill();

      // Test point indicator (white dashed outline)
      if (p.isTest) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#FFFFFF';
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.stroke();
      }
    });

    // 8. Draw K-Means Centroids
    if (algorithm === 'K-Means Clustering' && kCentroids.length > 0) {
      kCentroids.forEach((c, idx) => {
        const { sx, sy } = mathToScreen(c.x, c.y, width, height);

        // Outer glow circle
        ctx.beginPath();
        ctx.arc(sx, sy, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fill();

        // Star / cross marker
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(sx, sy, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#080D18';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#080D18';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillText(`μ${idx + 1}`, sx - 6, sy + 3);
      });
    }

    // 9. Draw Hovered Point Tooltip
    if (hoveredPoint) {
      const { sx, sy } = mathToScreen(hoveredPoint.x, hoveredPoint.y, width, height);
      ctx.fillStyle = 'rgba(21, 30, 48, 0.95)';
      ctx.strokeStyle = 'rgba(70, 215, 242, 0.5)';
      ctx.lineWidth = 1;
      ctx.fillRect(sx + 10, sy - 25, 95, 24);
      ctx.strokeRect(sx + 10, sy - 25, 95, 24);

      ctx.fillStyle = '#F2F5FC';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`(${hoveredPoint.x}, ${hoveredPoint.y})`, sx + 14, sy - 9);
    }
  }, [
    points,
    testPoints,
    algorithm,
    modelResult,
    isStale,
    viewTransform,
    kCentroids,
    probePoint,
    hoveredPoint,
    mathToScreen,
    screenToMath,
  ]);

  // Mouse Handlers
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { mx, my } = screenToMath(sx, sy, canvas.width, canvas.height);

    if (activeTool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (activeTool === 'draw') {
      onAddPoint?.({
        id: `custom-${Date.now()}`,
        x: mx,
        y: my,
        label: drawClass,
      });
      return;
    }

    if (activeTool === 'erase') {
      // Find point within radius
      const idx = points.findIndex((p) => {
        const { sx: px, sy: py } = mathToScreen(p.x, p.y, canvas.width, canvas.height);
        return Math.hypot(px - sx, py - sy) < 10;
      });
      if (idx !== -1) {
        onDeletePoint?.(points[idx].id);
      }
      return;
    }

    if (activeTool === 'inspect') {
      onProbe?.(mx, my);
      return;
    }

    if (activeTool === 'select') {
      // Check if clicking a K-Means centroid
      if (algorithm === 'K-Means Clustering' && kCentroids.length > 0) {
        const cIdx = kCentroids.findIndex((c) => {
          const { sx: cx, sy: cy } = mathToScreen(c.x, c.y, canvas.width, canvas.height);
          return Math.hypot(cx - sx, cy - sy) < 14;
        });
        if (cIdx !== -1) {
          setDraggedItem({ type: 'centroid', index: cIdx });
          return;
        }
      }

      // Check if clicking a data point
      const pIdx = points.findIndex((p) => {
        const { sx: px, sy: py } = mathToScreen(p.x, p.y, canvas.width, canvas.height);
        return Math.hypot(px - sx, py - sy) < 10;
      });
      if (pIdx !== -1) {
        setDraggedItem({ type: 'point', index: pIdx });
      }
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { mx, my } = screenToMath(sx, sy, canvas.width, canvas.height);

    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setViewTransform((prev) => ({
        ...prev,
        offsetX: prev.offsetX + dx,
        offsetY: prev.offsetY + dy,
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (draggedItem) {
      if (draggedItem.type === 'point' && points[draggedItem.index]) {
        onUpdatePoint?.(points[draggedItem.index].id, mx, my);
      } else if (draggedItem.type === 'centroid' && kCentroids[draggedItem.index]) {
        onCentroidDrag?.(draggedItem.index, mx, my);
      }
      return;
    }

    // Hover detection for coordinates
    const p = points.find((pt) => {
      const { sx: px, sy: py } = mathToScreen(pt.x, pt.y, canvas.width, canvas.height);
      return Math.hypot(px - sx, py - sy) < 10;
    });
    setHoveredPoint(p || null);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedItem(null);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setViewTransform((prev) => ({
      ...prev,
      scale: Math.max(25, Math.min(220, prev.scale * zoomFactor)),
    }));
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className={`w-full h-full ${
          activeTool === 'pan' ? 'cursor-grab active:cursor-grabbing' :
          activeTool === 'draw' ? 'cursor-crosshair' :
          activeTool === 'erase' ? 'cursor-pointer' :
          activeTool === 'inspect' ? 'cursor-help' : 'cursor-default'
        }`}
      />
    </div>
  );
}
