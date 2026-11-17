import { h } from "vue";
import { z } from "zod";
const coordinate = z.number().finite().min(-100000).max(100000);
const markerColor = z.string().regex(/^#[0-9a-f]{6}$/i);
export const parabolaSchema = z
  .object({
    version: z.literal(1).optional(),
    kind: z.enum(["quadratic", "linear"]).optional(),
    a: coordinate,
    b: coordinate,
    c: coordinate,
    xmin: coordinate.optional(),
    xmax: coordinate.optional(),
    ymin: coordinate.optional(),
    ymax: coordinate.optional(),
    axes: z.boolean().optional(),
    grid: z.boolean().optional(),
    equation: z.boolean().optional(),
    vertex: z.boolean().optional(),
    roots: z.boolean().optional(),
    numericMode: z.enum(["fa", "en"]).optional(),
    pointCoordinates: z.boolean().optional(),
    pointLabels: z.boolean().optional(),
    rootLabels: z.boolean().optional(),
    pointColor: markerColor.optional(),
    rootColor: markerColor.optional(),
    vertexColor: markerColor.optional(),
    color: z.enum(["#2457d6", "#32735c", "#a43232", "#172b4d"]).optional(),
    lineWidth: z.number().min(1).max(5).optional(),
    points: z
      .array(
        z
          .object({
            x: coordinate,
            y: coordinate,
            label: z.string().max(40),
            color: markerColor.optional(),
            showInfo: z.boolean().optional(),
          })
          .strict(),
      )
      .max(30)
      .optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (
      p.kind === "linear"
        ? p.a !== 0 || Math.abs(p.b) < 0.0001
        : Math.abs(p.a) < 0.0001
    )
      ctx.addIssue({
        code: "custom",
        path: [p.kind === "linear" ? "b" : "a"],
        message:
          p.kind === "linear"
            ? "ضریب x در معادله درجه یک نباید صفر باشد"
            : "ضریب a نباید صفر باشد",
      });
    for (const [min, max] of [
      ["xmin", "xmax"],
      ["ymin", "ymax"],
    ]) {
      if (
        (p[min] === undefined) !== (p[max] === undefined) ||
        (p[min] !== undefined && p[max] - p[min] < 0.001)
      )
        ctx.addIssue({
          code: "custom",
          message: "بازهٔ محورها معتبر نیست",
          path: [min],
        });
    }
  });
export function quadratic(p) {
  if (p.kind === "linear")
    return { x: 0, y: p.c, roots: p.b ? [-p.c / p.b] : [] };
  const x = -p.b / (2 * p.a),
    y = p.a * x * x + p.b * x + p.c;
  const d = p.b * p.b - 4 * p.a * p.c;
  let roots = [];
  if (d === 0) roots = [x];
  else if (d > 0) {
    const q = -0.5 * (p.b + (p.b < 0 ? -1 : 1) * Math.sqrt(d));
    roots = [q / p.a, p.c / q].sort((a, b) => a - b);
  }
  return { x, y, roots };
}
export function autoViewport(p) {
  const { x, y, roots } = quadratic(p);
  const radius = Math.min(
    100,
    Math.max(4, ...roots.map((r) => Math.abs(r - x) + 2)),
  );
  return {
    xmin: Math.max(-100000, Math.min(99999, x - radius)),
    xmax: Math.min(100000, Math.max(-99999, x + radius)),
    ymin: Math.max(-100000, Math.min(99999, Math.min(0, y) - radius)),
    ymax: Math.min(100000, Math.max(-99999, Math.max(0, y) + radius)),
  };
}
export function defaultParabola() {
  return {
    version: 1,
    a: 1,
    b: 0,
    c: 0,
    ...autoViewport({ a: 1, b: 0, c: 0 }),
    axes: true,
    grid: true,
    equation: true,
    vertex: true,
    roots: true,
    numericMode: "fa",
    pointCoordinates: true,
    pointLabels: true,
    rootLabels: true,
    color: "#2457d6",
    lineWidth: 2.5,
    points: [],
  };
}
export function graphGeometry(p) {
  const bounds = { ...autoViewport(p), ...p };
  const scale =
    320 / Math.max(bounds.xmax - bounds.xmin, bounds.ymax - bounds.ymin);
  const cx = (bounds.xmin + bounds.xmax) / 2,
    cy = (bounds.ymin + bounds.ymax) / 2;
  return {
    scale,
    toPixel: (x, y) => [200 + (x - cx) * scale, 200 - (y - cy) * scale],
    toMath: (x, y) => [cx + (x - 200) / scale, cy - (y - 200) / scale],
    bounds,
  };
}
const fmt = (n) => Number(n.toPrecision(5)).toString();
export function graphNumber(value, mode = "en") {
  const text = fmt(value);
  return mode === "fa"
    ? text.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]).replace(/\./g, "٫")
    : text;
}
export function parabolaSvg(input = defaultParabola(), options = {}) {
  const p = { ...defaultParabola(), ...input },
    geo = graphGeometry(p),
    { toPixel, toMath } = geo;
  const format = (n) => graphNumber(n, p.numericMode);
  const v = quadratic(p),
    children = [];
  const line = (x1, y1, x2, y2, stroke = "#dce3e8") =>
    h("line", { x1, y1, x2, y2, stroke, "stroke-width": 1 });
  const rawStep = 40 / geo.scale;
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 5, 10].map((n) => n * power).find((n) => n >= rawStep);
  const [left, bottom] = toMath(40, 360),
    [right, top] = toMath(360, 40);
  for (let i = 0; i < 32; i++) {
    const x = Math.ceil(left / step) * step + i * step;
    const y = Math.ceil(bottom / step) * step + i * step;
    if (x <= right) {
      const [px] = toPixel(x, 0);
      if (p.grid) children.push(line(px, 40, px, 360));
      if (p.axes)
        children.push(
          h(
            "text",
            { x: px, y: 375, "font-size": 9, "text-anchor": "middle" },
            format(x),
          ),
        );
    }
    if (y <= top) {
      const [, py] = toPixel(0, y);
      if (p.grid) children.push(line(40, py, 360, py));
      if (p.axes)
        children.push(
          h(
            "text",
            { x: 36, y: py, "font-size": 9, "text-anchor": "end" },
            format(y),
          ),
        );
    }
  }
  if (p.axes) {
    const [x, y] = toPixel(0, 0);
    if (x >= 40 && x <= 360) children.push(line(x, 40, x, 360, "#728394"));
    if (y >= 40 && y <= 360) children.push(line(40, y, 360, y, "#728394"));
    children.push(
      h("text", { x: 350, y: 375, "font-size": 12 }, "x"),
      h("text", { x: 24, y: 48, "font-size": 12 }, "y"),
    );
  }
  // Clip numerically: no shared SVG IDs, no unbounded SVG coordinates.
  let segment = [];
  const flush = () => {
    if (segment.length > 1)
      children.push(
        h("polyline", {
          points: segment.join(" "),
          fill: "none",
          stroke: p.color,
          "stroke-width": p.lineWidth,
        }),
      );
    segment = [];
  };
  for (let i = 0; i <= 640; i++) {
    const px = 40 + i / 2,
      [x] = toMath(px, 200);
    const [, py] = toPixel(x, p.a * x * x + p.b * x + p.c);
    if (py >= 40 && py <= 360) segment.push(`${px},${py}`);
    else flush();
  }
  flush();
  const marker = (x, y, label, vertex = false, index = -1, color) => {
    const [px, py] = toPixel(x, y);
    if (px < 40 || px > 360 || py < 40 || py > 360) return;
    children.push(
      h("circle", {
        cx: px,
        cy: py,
        r: (vertex || index >= 0) && options.interactive ? 9 : 4,
        fill:
          color ||
          (index >= 0
            ? p.pointColor || p.color
            : vertex
              ? p.vertexColor || "#a43232"
              : p.rootColor || "#a43232"),
        "data-marker": vertex ? "vertex" : index >= 0 ? "custom" : "root",
        "data-point": index >= 0 ? String(index) : undefined,
        "data-vertex": vertex ? "true" : undefined,
        style:
          (vertex || index >= 0) && options.interactive
            ? "cursor:move;pointer-events:all"
            : "pointer-events:none",
      }),
      label &&
        h(
          "text",
          {
            x: Math.min(300, Math.max(42, px + 7)),
            y: Math.max(52, py - 10),
            "font-size": 11,
            fill: "#172f43",
            style: "pointer-events:none",
          },
          label,
        ),
    );
  };
  if (p.vertex && p.kind !== "linear")
    marker(v.x, v.y, `V(${format(v.x)}, ${format(v.y)})`, true);
  if (p.roots)
    v.roots.forEach((x) =>
      marker(x, 0, p.rootLabels === false ? "" : format(x)),
    );
  (p.points || []).forEach((point, index) =>
    marker(
      point.x,
      point.y,
      p.pointLabels === false || point.showInfo === false
        ? ""
        : `${point.label}${p.pointCoordinates ? ` (${format(point.x)}, ${format(point.y)})` : ""}`,
      false,
      index,
      point.color,
    ),
  );
  if (p.equation)
    children.push(
      h(
        "text",
        { x: 12, y: 20, "font-size": 13, fill: "#172f43" },
        p.kind === "linear"
          ? `y = ${format(p.b)}x ${p.c < 0 ? "−" : "+"} ${format(Math.abs(p.c))}`
          : `y = ${format(p.a)}x² ${p.b < 0 ? "−" : "+"} ${format(Math.abs(p.b))}x ${p.c < 0 ? "−" : "+"} ${format(Math.abs(p.c))}`,
      ),
    );
  if (p.roots && p.rootLabels !== false)
    children.push(
      h(
        "text",
        { x: 12, y: 393, "font-size": 11, fill: "#172f43" },
        v.roots.length
          ? `x: ${v.roots.map(format).join(", ")}`
          : "بدون ریشهٔ حقیقی",
      ),
    );
  return h(
    "svg",
    {
      viewBox: "0 0 400 400",
      width: 400,
      height: 400,
      role: "img",
      "aria-label": p.kind === "linear" ? "نمودار معادله درجه یک" : "سهمی",
      dir: "ltr",
      direction: "ltr",
      style: "background:white;display:block;width:100%;height:auto",
    },
    children,
  );
}
