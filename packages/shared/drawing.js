import { z } from "zod";
import { h } from "vue";
export const shapeKinds = [
  "arrow",
  "line",
  "circle",
  "rectangle",
  "triangle",
  "angle",
  "axes",
  "text",
  "battery",
  "resistor",
  "switch",
  "lamp",
];
const finite = z.number().finite();
export const drawingSchema = z
  .object({
    version: z.literal(1),
    width: finite.min(200).max(650),
    height: finite.min(100).max(600),
    grid: z.boolean(),
    label: z.string().max(200),
    shapes: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            kind: z.enum(shapeKinds),
            x: finite.min(0).max(650),
            y: finite.min(0).max(600),
            width: finite.min(10).max(650),
            height: finite.min(10).max(600),
            rotation: finite.min(-360).max(360),
            label: z.string().max(120),
            stroke: z.enum(["#172f43", "#000000", "#a43232", "#32735c"]),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export const shapeLabels = {
  arrow: "بردار",
  line: "خط / سیم",
  circle: "دایره",
  rectangle: "مستطیل",
  triangle: "مثلث",
  angle: "زاویه",
  axes: "محورها",
  text: "برچسب",
  battery: "باتری",
  resistor: "مقاومت",
  switch: "کلید",
  lamp: "لامپ",
};
export const emptyDrawing = () => ({
  version: 1,
  width: 600,
  height: 320,
  grid: false,
  label: "شکل سؤال",
  shapes: [],
});
export function createShape(kind, id) {
  return {
    id,
    kind,
    x: 60,
    y: 60,
    width: kind === "text" ? 120 : 100,
    height: kind === "line" || kind === "arrow" ? 20 : 80,
    rotation: 0,
    label: kind === "text" ? "A" : "",
    stroke: "#172f43",
  };
}
export function drawingPreset(name, uid) {
  const drawing = emptyDrawing();
  const add = (kind, attrs) =>
    drawing.shapes.push({ ...createShape(kind, uid()), ...attrs });
  if (name === "force") {
    drawing.label = "نمودار نیرو";
    add("rectangle", { x: 250, y: 140, width: 60, height: 60, label: "m" });
    add("arrow", {
      x: 280,
      y: 130,
      width: 110,
      height: 20,
      rotation: -90,
      label: "N",
    });
    add("arrow", {
      x: 280,
      y: 200,
      width: 90,
      height: 20,
      rotation: 90,
      label: "mg",
    });
    add("arrow", { x: 310, y: 170, width: 120, height: 20, label: "F" });
  } else if (name === "incline") {
    drawing.label = "جسم روی سطح شیب‌دار";
    add("triangle", { x: 100, y: 130, width: 330, height: 150 });
    add("rectangle", {
      x: 220,
      y: 165,
      width: 65,
      height: 45,
      rotation: -24,
      label: "m",
    });
    add("arrow", {
      x: 250,
      y: 200,
      width: 100,
      height: 20,
      rotation: 90,
      label: "mg",
    });
    add("angle", { x: 360, y: 225, width: 60, height: 50, label: "θ" });
  } else if (name === "circuit") {
    drawing.label = "مدار الکتریکی ساده";
    add("line", { x: 110, y: 80, width: 100, height: 20 });
    add("resistor", { x: 210, y: 60, width: 120, height: 40, label: "R" });
    add("line", { x: 330, y: 80, width: 150, height: 20 });
    add("line", { x: 480, y: 80, width: 170, height: 20, rotation: 90 });
    add("line", { x: 110, y: 250, width: 370, height: 20 });
    add("battery", {
      x: 85,
      y: 250,
      width: 170,
      height: 50,
      rotation: -90,
      label: "V",
    });
  }
  return drawing;
}
function path(d) {
  return h("path", { d, fill: "none" });
}
export function shapeGraphic(shape) {
  const w = shape.width,
    ht = shape.height,
    middle = ht / 2;
  const line = (x1, y1, x2, y2) => h("line", { x1, y1, x2, y2 });
  const arrow = () => [
    line(0, 0, w, 0),
    path(`M${w - 10},-5 L${w},0 L${w - 10},5`),
  ];
  let nodes;
  switch (shape.kind) {
    case "arrow":
      nodes = arrow();
      break;
    case "line":
      nodes = [line(0, 0, w, 0)];
      break;
    case "rectangle":
      nodes = [h("rect", { width: w, height: ht, fill: "white" })];
      break;
    case "circle":
      nodes = [
        h("ellipse", {
          cx: w / 2,
          cy: middle,
          rx: w / 2,
          ry: middle,
          fill: "white",
        }),
      ];
      break;
    case "triangle":
      nodes = [path(`M0,${ht} L${w},0 L${w},${ht} Z`)];
      break;
    case "angle":
      nodes = [
        path(`M0,0 L0,${ht} L${w},${ht} M0,${ht - 25} A25,25 0 0 1 25,${ht}`),
      ];
      break;
    case "axes":
      nodes = [
        line(0, ht, w, ht),
        path(`M${w - 9},${ht - 5} L${w},${ht} L${w - 9},${ht + 5}`),
        line(w / 2, ht, w / 2, 0),
        path(`M${w / 2 - 5},9 L${w / 2},0 L${w / 2 + 5},9`),
      ];
      break;
    case "battery":
      nodes = [
        line(0, middle, w * 0.4, middle),
        line(w * 0.4, 0, w * 0.4, ht),
        line(w * 0.6, ht * 0.25, w * 0.6, ht * 0.75),
        line(w * 0.6, middle, w, middle),
      ];
      break;
    case "resistor":
      nodes = [
        path(
          `M0,${middle} H${w * 0.2} l${w * 0.1},-${ht * 0.3} l${w * 0.1},${ht * 0.6} l${w * 0.1},-${ht * 0.6} l${w * 0.1},${ht * 0.6} l${w * 0.1},-${ht * 0.3} H${w}`,
        ),
      ];
      break;
    case "switch":
      nodes = [
        path(
          `M0,${middle} H${w * 0.3} L${w * 0.7},0 M${w * 0.7},${middle} H${w}`,
        ),
      ];
      break;
    case "lamp":
      nodes = [
        line(0, middle, w * 0.25, middle),
        h("ellipse", {
          cx: w / 2,
          cy: middle,
          rx: w * 0.25,
          ry: middle,
          fill: "white",
        }),
        line(w * 0.32, ht * 0.2, w * 0.68, ht * 0.8),
        line(w * 0.32, ht * 0.8, w * 0.68, ht * 0.2),
        line(w * 0.75, middle, w, middle),
      ];
      break;
    default:
      nodes = [];
  }
  if (shape.label)
    nodes.push(
      h(
        "text",
        {
          x: shape.kind === "text" ? 0 : w / 2,
          y: shape.kind === "text" ? 20 : -10,
          "text-anchor": shape.kind === "text" ? "start" : "middle",
          fill: shape.stroke,
          stroke: "none",
          "font-size": 18,
          transform:
            shape.kind === "text" ? `scale(${w / 120} ${ht / 80})` : undefined,
          direction: "auto",
          style: { unicodeBidi: "plaintext" },
        },
        shape.label,
      ),
    );
  return nodes;
}
export function drawingSvg(drawing, options = {}) {
  const grid = [];
  if (drawing.grid) {
    for (let x = 0; x <= drawing.width; x += 20)
      grid.push(h("line", { x1: x, y1: 0, x2: x, y2: drawing.height }));
    for (let y = 0; y <= drawing.height; y += 20)
      grid.push(h("line", { x1: 0, y1: y, x2: drawing.width, y2: y }));
  }
  return h(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${drawing.width} ${drawing.height}`,
      width: drawing.width,
      height: drawing.height,
      role: "img",
      "aria-label": drawing.label,
      style: { maxWidth: "100%", height: "auto", overflow: "visible" },
      ...options,
    },
    [
      h("title", drawing.label),
      h("g", { stroke: "#dce3e8", "stroke-width": 0.5 }, grid),
      ...drawing.shapes.map((shape) =>
        h(
          "g",
          {
            key: shape.id,
            transform: `translate(${shape.x} ${shape.y}) rotate(${shape.rotation})`,
            stroke: shape.stroke,
            "stroke-width": 2,
            fill: "none",
            "stroke-linejoin": "round",
          },
          shapeGraphic(shape),
        ),
      ),
    ],
  );
}
