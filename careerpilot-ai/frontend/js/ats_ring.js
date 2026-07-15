/**
 * ats_ring.js — Animated SVG-canvas ATS score ring
 * Draws a circular progress ring on a <canvas> element and animates it
 * from 0 to the target score value.
 */

const AtsRing = (() => {
  const TRACK_COLOR   = 'rgba(255,255,255,0.06)';
  const TRACK_WIDTH   = 12;
  const BAR_WIDTH     = 12;
  const START_ANGLE   = -Math.PI / 2;  // 12 o'clock
  const ANIM_DURATION = 1200;          // ms

  /**
   * Return the ring colour based on score band.
   * < 40  → red gradient
   * 40–69 → amber gradient
   * 70+   → green-to-purple gradient
   */
  function getScoreGradient(ctx, cx, cy, radius, score) {
    const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    if (score < 40) {
      grad.addColorStop(0, '#f43f5e');
      grad.addColorStop(1, '#fb7185');
    } else if (score < 70) {
      grad.addColorStop(0, '#f59e0b');
      grad.addColorStop(1, '#fbbf24');
    } else {
      grad.addColorStop(0, '#8b5cf6');
      grad.addColorStop(1, '#06b6d4');
    }
    return grad;
  }

  /**
   * Draw a single frame of the ring.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx  - center x
   * @param {number} cy  - center y
   * @param {number} radius
   * @param {number} progress - 0 to 1
   * @param {number} targetScore - used only for gradient colour
   */
  function drawFrame(ctx, cx, cy, radius, progress, targetScore) {
    const dpr   = window.devicePixelRatio || 1;
    const size  = cx * 2 * dpr;
    ctx.clearRect(0, 0, size, size);

    // Scale for HiDPI
    ctx.save();
    ctx.scale(dpr, dpr);

    // Track (background circle)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = TRACK_COLOR;
    ctx.lineWidth   = TRACK_WIDTH;
    ctx.stroke();

    // Progress arc
    if (progress > 0) {
      const endAngle = START_ANGLE + (Math.PI * 2 * progress);
      const grad = getScoreGradient(ctx, cx, cy, radius, targetScore);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, START_ANGLE, endAngle);
      ctx.strokeStyle = grad;
      ctx.lineWidth   = BAR_WIDTH;
      ctx.lineCap     = 'round';
      ctx.stroke();

      // Glow effect at the tip
      const tipX = cx + radius * Math.cos(endAngle);
      const tipY = cy + radius * Math.sin(endAngle);
      const glow = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, BAR_WIDTH * 1.5);
      glow.addColorStop(0, targetScore >= 70 ? 'rgba(139,92,246,0.5)' :
                            targetScore >= 40 ? 'rgba(245,158,11,0.5)' : 'rgba(244,63,94,0.5)');
      glow.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(tipX, tipY, BAR_WIDTH * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Easing function — ease-out cubic.
   */
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Animate the ring from 0 to `score`.
   * @param {HTMLCanvasElement} canvas
   * @param {number} score - 0 to 100
   * @param {Function} [onFrame] - called each frame with the current displayed value
   */
  function animate(canvas, score, onFrame) {
    const dpr    = window.devicePixelRatio || 1;
    const size   = 160;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = size + 'px';
    canvas.style.height = size + 'px';

    const ctx    = canvas.getContext('2d');
    const cx     = size / 2;
    const cy     = size / 2;
    const radius = (size / 2) - (TRACK_WIDTH / 2) - 4;

    const clampedScore = Math.max(0, Math.min(100, score));
    const target       = clampedScore / 100;

    let startTime = null;

    function frame(ts) {
      if (!startTime) startTime = ts;
      const elapsed  = ts - startTime;
      const rawT     = Math.min(elapsed / ANIM_DURATION, 1);
      const easedT   = easeOutCubic(rawT);
      const progress = easedT * target;

      drawFrame(ctx, cx, cy, radius, progress, clampedScore);

      if (onFrame) {
        onFrame(Math.round(easedT * clampedScore));
      }

      if (rawT < 1) {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
  }

  /**
   * Render a static ring (no animation) — useful for resets or placeholders.
   */
  function renderStatic(canvas, score) {
    animate(canvas, score);
  }

  return { animate, renderStatic };
})();
