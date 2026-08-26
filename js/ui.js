export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function toast(msg) {
  let n = document.querySelector(".toast");
  if (!n) {
    n = el('<div class="toast"></div>');
    document.body.appendChild(n);
  }
  n.textContent = msg;
  n.classList.add("show");
  setTimeout(() => n.classList.remove("show"), 1800);
}

export function svgIcons() {
  return {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></svg>',
    full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
    sectional: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h10M4 17h7"/></svg>',
    quiz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>'
  };
}

export function pctBar(pct, klass = "") {
  const w = Math.max(0, Math.min(100, Number(pct) || 0));
  return `<div class="bar"><i class="${klass}" style="width:${w}%"></i></div>`;
}

export function drawSpark(canvas, points, color = "#5eead4") {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  if (!points.length) return;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys, 0);
  const max = Math.max(...ys, 100);
  const pad = 8;
  const xAt = (i) => pad + (i * (w - pad * 2)) / Math.max(points.length - 1, 1);
  const yAt = (y) => h - pad - ((y - min) / (max - min || 1)) * (h - pad * 2);
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xAt(i);
    const y = yAt(p.y);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = "round";
  ctx.stroke();
  const last = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(xAt(points.length - 1), yAt(last.y), 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}
