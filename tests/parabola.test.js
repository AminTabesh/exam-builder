import { test } from "node:test";
import assert from "node:assert/strict";
import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";
import {
  defaultParabola,
  parabolaSchema,
  quadratic,
  graphGeometry,
  parabolaSvg,
} from "@exam/shared/parabola.js";
import {
  exampleExam,
  examSchema,
  validateForExport,
} from "@exam/shared/exam.js";
import { richBlocks } from "@exam/shared/PrintDocument.js";
import { visualStyle } from "@exam/shared/visualLayout.js";
test("quadratics distinguish real, repeated and absent roots", () => {
  assert.deepEqual(quadratic({ a: 1, b: -3, c: 2 }).roots, [1, 2]);
  assert.deepEqual(quadratic({ a: 1, b: -2, c: 1 }).roots, [1]);
  assert.deepEqual(quadratic({ a: 1, b: 0, c: 1 }).roots, []);
  assert.equal(quadratic({ a: -1, b: 4, c: 0 }).x, 2);
});
test("graph coordinates preserve equal scale and roundtrip vertex dragging", () => {
  const p = defaultParabola(),
    g = graphGeometry(p);
  assert.deepEqual(g.toMath(...g.toPixel(2, 3)), [2, 3]);
  const x = 2,
    y = -3,
    a = p.a,
    b = -2 * a * x,
    c = y + a * x * x;
  const result = quadratic({ a, b, c });
  assert.equal(result.x, x);
  assert.equal(result.y, y);
  assert.ok(Math.abs(result.roots[0] - (2 - Math.sqrt(3))) < 1e-12);
});
test("invalid coefficients and viewport are rejected", () => {
  for (const p of [
    { a: 0 },
    { a: Infinity },
    { xmin: 5, xmax: 2 },
    { xmin: 0, xmax: 0 },
    { b: NaN },
  ])
    assert.equal(
      parabolaSchema.safeParse({ ...defaultParabola(), ...p }).success,
      false,
    );
});
test("graph-only exams validate and saved attributes roundtrip", () => {
  const e = exampleExam();
  e.questions = e.questions.slice(0, 1);
  e.questions[0].body = {
    type: "doc",
    content: [
      {
        type: "parabola",
        attrs: { parabola: defaultParabola(), width: 200, wrap: "right" },
      },
    ],
  };
  assert.deepEqual(validateForExport(e), []);
  assert.equal(
    examSchema.parse(JSON.parse(JSON.stringify(e))).questions[0].body.content[0]
      .attrs.wrap,
    "right",
  );
});
test("SVG output is bounded, has no shared ids, and toggles annotations", async () => {
  const html = await renderToString(
    createSSRApp({
      render: () =>
        h("div", [
          parabolaSvg({ ...defaultParabola(), a: 100000 }),
          parabolaSvg({
            ...defaultParabola(),
            equation: false,
            roots: false,
            vertex: false,
          }),
        ]),
    }),
  );
  assert.ok(!html.includes("NaN"));
  assert.ok(!html.includes("Infinity"));
  assert.ok(!html.includes('id="'));
  assert.equal((html.match(/y =/g) || []).length, 1);
});
test("wrapped visuals group with following text and preserve old image alignment", () => {
  const nodes = [
    { type: "parabola", attrs: { parabola: defaultParabola(), wrap: "left" } },
    { type: "paragraph", content: [{ type: "text", text: "text" }] },
    { type: "drawing", attrs: { drawing: {} } },
  ];
  const blocks = richBlocks(nodes.slice(0, 2));
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].props.class, "visual-wrap-group");
  assert.equal(visualStyle({ imageAlign: "end" }).marginInlineStart, "auto");
  assert.equal(
    visualStyle({ drawing: { width: 600 } }, "drawing").width,
    "600px",
  );
});

test("Persian numerals and named custom points survive schema and SVG rendering", async () => {
  const p = {
    ...defaultParabola(),
    numericMode: "fa",
    points: [{ x: 1.5, y: -2, label: "A <script>" }],
    pointCoordinates: true,
  };
  assert.equal(parabolaSchema.parse(p).points[0].x, 1.5);
  const html = await renderToString(
    createSSRApp({ render: () => parabolaSvg(p) }),
  );
  assert.match(html, /۱٫۵/);
  assert.match(html, /-۲/);
  assert.match(html, /A &lt;script&gt;/);
  assert.ok(!html.includes("<script>"));
  const en = await renderToString(
    createSSRApp({
      render: () =>
        parabolaSvg({ ...p, numericMode: "en", pointCoordinates: false }),
    }),
  );
  assert.ok(!en.includes("۱"));
  assert.ok(!en.includes("1.5, -2"));
  for (const patch of [
    { points: Array.from({ length: 31 }, () => ({ x: 0, y: 0, label: "A" })) },
    { points: [{ x: Infinity, y: 0, label: "A" }] },
    { points: [{ x: 0, y: 0, label: "A".repeat(41) }] },
    { numericMode: "invalid" },
    { color: "url(bad)" },
    { lineWidth: 100 },
  ])
    assert.equal(parabolaSchema.safeParse({ ...p, ...patch }).success, false);
});

test("linear equations validate, find their root and render without a vertex", async () => {
  const p = {
    ...defaultParabola(),
    kind: "linear",
    a: 0,
    b: 2,
    c: -4,
    numericMode: "en",
  };
  assert.equal(parabolaSchema.safeParse(p).success, true);
  assert.deepEqual(quadratic(p).roots, [2]);
  for (const patch of [{ b: 0 }, { a: 1 }])
    assert.equal(parabolaSchema.safeParse({ ...p, ...patch }).success, false);
  const html = await renderToString(
    createSSRApp({ render: () => parabolaSvg(p) }),
  );
  assert.match(html, /y = 2x \+ 4|y = 2x − 4/);
  assert.ok(!html.includes('data-marker="vertex"'));
  assert.ok(!html.includes("NaN"));
  assert.ok(!html.includes("Infinity"));
  assert.ok(!html.includes("x²"));
});
test("marker colors and visibility controls survive schema and rendering", async () => {
  const p = {
    ...defaultParabola(),
    a: 1,
    b: 0,
    c: -1,
    vertex: false,
    rootColor: "#112233",
    pointColor: "#223344",
    equation: false,
    rootLabels: false,
    points: [
      { x: 1, y: 2, label: "SECRET", color: "#abcdef", showInfo: false },
    ],
  };
  const parsed = parabolaSchema.parse(JSON.parse(JSON.stringify(p)));
  const render = (value) =>
    renderToString(createSSRApp({ render: () => parabolaSvg(value) }));
  const html = await render(parsed);
  assert.match(html, /fill="#112233"/);
  assert.match(html, /fill="#abcdef"/);
  assert.match(html, /data-marker="root"/);
  assert.ok(!html.includes("SECRET"));
  assert.ok(!html.includes("y ="));
  assert.ok(
    !(await render({ ...parsed, roots: false })).includes('data-marker="root"'),
  );
  assert.ok(
    (
      await render({
        ...parsed,
        pointLabels: true,
        points: [{ x: 1, y: 2, label: "VISIBLE" }],
      })
    ).includes("VISIBLE"),
  );
  for (const color of ["url(bad)", "red", "#1234567"])
    assert.equal(
      parabolaSchema.safeParse({ ...p, rootColor: color }).success,
      false,
    );
});
