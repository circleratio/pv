const FADE_DURATION_MS = 1500;
// Radius as a fraction of the overlay canvas's shorter side, so the dot scales
// with the display instead of staying a fixed pixel size. ~0.007 gives a ~11px
// diameter on a ~768px-tall window, a quarter of the previous fixed 44px diameter.
const RADIUS_RATIO = 0.007;
const COLOR_RGB = "255, 140, 0"; // orange

let strokes = [];
let activeStroke = null;
let loopRunning = false;

/**
 * Converts viewport-relative coordinates (e.g. MouseEvent.clientX/clientY) into
 * coordinates local to the overlay canvas, since the canvas is centered within
 * the window rather than pinned to its top-left corner.
 */
function toCanvasCoordinates(clientX, clientY) {
  const canvas = document.getElementById("overlay-canvas");
  if (!canvas) return { x: clientX, y: clientY };

  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export function startStroke(x, y) {
  activeStroke = { points: [toCanvasCoordinates(x, y)], endedAt: null };
  strokes.push(activeStroke);
  scheduleLoop();
}

export function addPoint(x, y) {
  if (!activeStroke) return;
  activeStroke.points.push(toCanvasCoordinates(x, y));
}

export function endStroke() {
  if (!activeStroke) return;
  activeStroke.endedAt = Date.now();
  activeStroke = null;
}

/**
 * Opacity of a stroke at time `now`: 1 while still being drawn, then linearly
 * fading to 0 over FADE_DURATION_MS after endStroke() was called.
 */
export function calculateOpacity(stroke, now) {
  if (stroke.endedAt === null) return 1;
  const elapsed = now - stroke.endedAt;
  return Math.max(0, 1 - elapsed / FADE_DURATION_MS);
}

/** Read-only snapshot of the current strokes, for inspection/testing. */
export function getStrokes() {
  return strokes.map((stroke) => ({ ...stroke, points: [...stroke.points] }));
}

/** Line half-width (and single-click dot radius) for a canvas of the given size. */
export function calculateRadius(canvasWidth, canvasHeight) {
  return Math.min(canvasWidth, canvasHeight) * RADIUS_RATIO;
}

/**
 * Draws all strokes onto the overlay canvas as a rounded line connecting each
 * point to the next (a single-point stroke, i.e. a plain click, is drawn as a
 * zero-length segment, which renders as a round dot), and discards fully
 * faded ones.
 */
export function render() {
  const now = Date.now();
  const canvas = document.getElementById("overlay-canvas");
  const ctx = canvas?.getContext("2d");

  if (ctx) {
    const radius = calculateRadius(canvas.width, canvas.height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = radius * 2;
    for (const stroke of strokes) {
      const opacity = calculateOpacity(stroke, now);
      ctx.strokeStyle = `rgba(${COLOR_RGB}, ${opacity})`;
      ctx.beginPath();
      const [first, ...rest] = stroke.points;
      ctx.moveTo(first.x, first.y);
      for (const point of rest) {
        ctx.lineTo(point.x, point.y);
      }
      if (rest.length === 0) {
        ctx.lineTo(first.x, first.y);
      }
      ctx.stroke();
    }
  }

  strokes = strokes.filter((stroke) => calculateOpacity(stroke, now) > 0);
}

function scheduleLoop() {
  if (loopRunning) return;
  loopRunning = true;
  const tick = () => {
    render();
    if (strokes.length > 0) {
      requestAnimationFrame(tick);
    } else {
      loopRunning = false;
    }
  };
  requestAnimationFrame(tick);
}

/** Resets all module state. Intended for test isolation. */
export function reset() {
  strokes = [];
  activeStroke = null;
  loopRunning = false;
}
