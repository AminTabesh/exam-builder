import {
  mdiCursorMove,
  mdiWrap,
  mdiFormatFloatRight,
  mdiFormatFloatLeft,
  mdiFormatAlignRight,
  mdiFormatAlignCenter,
  mdiFormatAlignLeft,
  mdiArrowUp,
  mdiArrowDown,
  mdiPencilOutline,
  mdiTrashCanOutline,
} from "@mdi/js";
import { closeHistory } from "@tiptap/pm/history";
import { resourceUrl } from "@exam/shared/resources.js";
import { createApp, h, shallowRef } from "vue";
import { drawingSvg } from "@exam/shared/drawing.js";
import { parabolaSvg } from "@exam/shared/parabola.js";
import { visualStyle } from "@exam/shared/visualLayout.js";
// Pointer gestures mutate only presentation until pointerup; one transaction per gesture.
export function visualNodeView(edit) {
  return ({ node, editor, getPos }) => {
    const current = shallowRef(node),
      dom = document.createElement("div");
    dom.className = "visual-frame";
    dom.contentEditable = "false";
    dom.dataset.visual = node.type.name;
    const content = document.createElement("div");
    content.className = "visual-content";
    dom.append(content);
    const app = createApp({
      render: () => {
        const n = current.value;
        return n.type.name === "image"
          ? h("img", {
              src: resourceUrl(n.attrs.src),
              alt: n.attrs.alt || "",
              draggable: false,
            })
          : n.type.name === "drawing"
            ? drawingSvg(n.attrs.drawing)
            : parabolaSvg(n.attrs.parabola);
      },
    });
    app.mount(content);
    const toolbar = document.createElement("div");
    toolbar.className = "visual-toolbar";
    toolbar.setAttribute("role", "group");
    toolbar.setAttribute("aria-label", "تنظیمات شکل");
    dom.append(toolbar);
    let toolbarTarget = toolbar;
    const group = (label) => {
      const element = document.createElement("div");
      element.className = "visual-tool-group";
      element.setAttribute("role", "group");
      element.setAttribute("aria-label", label);
      const caption = document.createElement("span");
      caption.className = "visual-tool-caption";
      caption.textContent = label;
      element.append(caption);
      toolbar.append(element);
      toolbarTarget = element;
      return element;
    };
    const icons = {
      جابجایی: mdiCursorMove,
      "در متن": mdiWrap,
      "کنار متن راست": mdiFormatFloatRight,
      "کنار متن چپ": mdiFormatFloatLeft,
      ابتدا: mdiFormatAlignRight,
      وسط: mdiFormatAlignCenter,
      انتها: mdiFormatAlignLeft,
      بالاتر: mdiArrowUp,
      پایین‌تر: mdiArrowDown,
      ویرایش: mdiPencilOutline,
      حذف: mdiTrashCanOutline,
    };
    const button = (label, action) => {
      const b = document.createElement("button");
      b.type = "button";
      b.title = label;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", "18");
      svg.setAttribute("height", "18");
      svg.setAttribute("fill", "currentColor");
      svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute("d", icons[label]);
      svg.append(path);
      b.append(svg);
      if (label === "ویرایش") {
        const text = document.createElement("span");
        text.textContent = label;
        b.append(text);
        b.classList.add("visual-edit");
      }
      if (label === "حذف") b.classList.add("visual-delete");
      b.setAttribute("aria-label", label);
      b.onpointerdown = (e) => e.stopPropagation();
      b.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        action();
      };
      toolbarTarget.append(b);
      return b;
    };
    const position = () => getPos();
    const select = () => {
      const pos = position();
      if (typeof pos === "number") editor.commands.setNodeSelection(pos);
    };
    const update = (attrs) => {
      editor.view.dispatch(closeHistory(editor.state.tr));
      select();
      editor
        .chain()
        .focus()
        .updateAttributes(current.value.type.name, attrs)
        .run();
    };
    const paint = () => {
      toolbar
        .querySelectorAll("[data-wrap]")
        .forEach((button) =>
          button.setAttribute(
            "aria-pressed",
            String(
              button.dataset.wrap === (current.value.attrs.wrap || "none"),
            ),
          ),
        );
      toolbar.querySelectorAll("[data-align]").forEach((button) => {
        button.setAttribute(
          "aria-pressed",
          String(
            (!current.value.attrs.wrap ||
              current.value.attrs.wrap === "none") &&
              button.dataset.align ===
                (current.value.attrs.imageAlign || "start"),
          ),
        );
      });
      Object.assign(
        dom.style,
        visualStyle(current.value.attrs, current.value.type.name),
      );
    };
    paint();
    let gesture;
    const guide = document.createElement("div");
    guide.className = "visual-drop-guide";
    guide.hidden = true;
    const end = (cancel) => {
      if (!gesture) return;
      const g = gesture;
      gesture = null;
      guide.remove();
      dom.classList.remove("visual-dragging");
      paint();
      if (cancel) return;
      if (g.kind === "resize") {
        if (g.width !== undefined) update({ width: g.width });
        return;
      }
      if (g.target === undefined) return;
      const from = position(),
        n = current.value,
        size = n.nodeSize,
        target = g.target;
      if (target >= from && target <= from + size) {
        update({ wrap: g.wrap });
        return;
      }
      const tr = closeHistory(editor.state.tr).delete(from, from + size);
      const dest = tr.mapping.map(target);
      tr.insert(dest, n.type.create({ ...n.attrs, wrap: g.wrap }, n.content));
      tr.setMeta("uiEvent", "drop");
      editor.view.dispatch(tr);
      editor.commands.setNodeSelection(dest);
    };
    const move = (e) => {
      if (!gesture || e.pointerId !== gesture.pointer) return;
      const g = gesture;
      if (g.kind === "resize") {
        const direction = g.corner.includes("w") ? -1 : 1;
        const dx = direction * (e.clientX - g.x);
        const dy =
          (g.corner.includes("n") ? -1 : 1) * (e.clientY - g.y) * g.ratio;
        const delta = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
        g.width = Math.round(
          Math.max(20, Math.min(650, g.max, g.widthStart + delta)),
        );
        dom.style.width = `${g.width}px`;
        return;
      }
      const root = editor.view.dom,
        bounds = root.getBoundingClientRect();
      if (
        e.clientX < bounds.left ||
        e.clientX > bounds.right ||
        e.clientY < bounds.top ||
        e.clientY > bounds.bottom
      ) {
        g.target = undefined;
        guide.hidden = true;
        return;
      }
      const hit = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (!hit) return;
      const resolved = editor.state.doc.resolve(hit.pos);
      let target;
      if (resolved.depth) {
        const depth = 1,
          start = resolved.before(depth),
          el = editor.view.nodeDOM(start),
          r = el?.getBoundingClientRect();
        target =
          r && e.clientY > r.top + r.height / 2 ? resolved.after(depth) : start;
      } else target = hit.pos;
      g.target = target;
      g.wrap =
        e.clientX < bounds.left + bounds.width * 0.25
          ? "left"
          : e.clientX > bounds.right - bounds.width * 0.25
            ? "right"
            : "none";
      const coords = editor.view.coordsAtPos(target);
      guide.hidden = false;
      Object.assign(guide.style, {
        position: "fixed",
        left: `${bounds.left}px`,
        top: `${coords.top}px`,
        width: `${bounds.width}px`,
      });
      guide.textContent =
        g.wrap === "none"
          ? "درج در متن"
          : g.wrap === "left"
            ? "کنار متن چپ"
            : "کنار متن راست";
    };
    const begin = (e, kind, corner = "se") => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      select();
      gesture = {
        kind,
        corner,
        pointer: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        ratio: dom.clientWidth / Math.max(1, content.clientHeight),
        widthStart: dom.getBoundingClientRect().width,
        max: editor.view.dom.clientWidth,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      if (kind === "move") {
        document.body.append(guide);
        dom.classList.add("visual-dragging");
      }
    };
    group("شکل");
    const drag = button("جابجایی", () => {});
    drag.classList.add("visual-move");
    drag.onpointerdown = (e) => begin(e, "move");
    group("جای‌گیری");
    for (const [side, label] of [
      ["none", "در متن"],
      ["right", "کنار متن راست"],
      ["left", "کنار متن چپ"],
    ])
      button(label, () => update({ wrap: side })).dataset.wrap = side;
    group("تراز");
    for (const [align, label] of [
      ["start", "ابتدا"],
      ["center", "وسط"],
      ["end", "انتها"],
    ])
      button(label, () =>
        update({ wrap: "none", imageAlign: align }),
      ).dataset.align = align;
    function reorder(delta) {
      const from = position(),
        doc = editor.state.doc,
        $p = doc.resolve(from),
        index = $p.index();
      if (index + delta < 0 || index + delta >= doc.childCount) return;
      const target =
        delta < 0
          ? from - doc.child(index - 1).nodeSize
          : from + current.value.nodeSize + doc.child(index + 1).nodeSize;
      gesture = { kind: "move", target, wrap: current.value.attrs.wrap };
      end(false);
    }
    group("ترتیب");
    button("بالاتر", () => reorder(-1));
    button("پایین‌تر", () => reorder(1));
    group("عملیات");
    if (node.type.name !== "image")
      button("ویرایش", () => {
        select();
        edit(current.value.type.name);
      });
    button("حذف", () => {
      select();
      editor.commands.deleteSelection();
    });
    const label = document.createElement("label");
    label.className = "visual-width-control";
    label.textContent = "عرض";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "20";
    input.max = "650";
    input.setAttribute("aria-label", "عرض شکل");
    input.value = node.attrs.width || 400;
    input.onchange = () =>
      update({
        width: Math.max(20, Math.min(650, Number(input.value) || 240)),
      });
    label.append(input);
    const unit = document.createElement("span");
    unit.textContent = "px";
    unit.className = "visual-width-unit";
    label.append(unit);
    toolbar.append(label);
    paint();
    for (const corner of ["nw", "ne", "sw", "se"]) {
      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = `visual-resize visual-${corner}`;
      handle.setAttribute("aria-label", "تغییر اندازه");
      handle.onpointerdown = (e) => begin(e, "resize", corner);
      handle.onkeydown = (e) => {
        if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          update({
            width: Math.max(
              20,
              Math.min(
                650,
                (current.value.attrs.width || 400) +
                  (e.key === "ArrowRight" ? 10 : -10),
              ),
            ),
          });
        }
      };
      dom.append(handle);
    }
    dom.addEventListener("pointermove", move);
    dom.addEventListener("pointerup", () => end(false));
    dom.addEventListener("pointercancel", () => end(true));
    const escape = (e) => {
      if (e.key === "Escape" && gesture) {
        e.preventDefault();
        e.stopPropagation();
        end(true);
      }
    };
    document.addEventListener("keydown", escape, true);
    dom.ondragstart = (e) => e.preventDefault();
    dom.onclick = (e) => {
      if (!e.target.closest("button,input")) select();
    };
    dom.ondblclick = () => {
      select();
      if (current.value.type.name !== "image") edit(current.value.type.name);
    };
    return {
      dom,
      update(n) {
        if (n.type !== current.value.type) return false;
        current.value = n;
        input.value = n.attrs.width || 400;
        if (!gesture) paint();
        return true;
      },
      selectNode() {
        dom.classList.add("is-selected");
      },
      deselectNode() {
        dom.classList.remove("is-selected");
      },
      stopEvent: (e) =>
        !!e.target.closest("button,input,.visual-toolbar") || !!gesture,
      ignoreMutation: () => true,
      destroy() {
        end(true);
        document.removeEventListener("keydown", escape, true);
        app.unmount();
      },
    };
  };
}
