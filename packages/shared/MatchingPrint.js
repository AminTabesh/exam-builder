import { h } from "vue";
import { matchingLabel } from "./matching.js";
export function matchingBoard(question, rich, language, kind) {
  const matching = question.matching;
  if (!matching) return null;
  const en = language === "en";
  return h(
    "div",
    {
      class: "matching-print-board",
      "data-matching-pairs":
        kind === "answer-key" ? JSON.stringify(matching.pairs) : undefined,
    },
    [
      ...["left", "right"].map((side) =>
        h(
          "section",
          { class: `matching-print-column matching-print-${side}` },
          [
            h(
              "strong",
              { class: "matching-column-title" },
              side === "left"
                ? en
                  ? "Column A"
                  : "ستون اول"
                : en
                  ? "Column B"
                  : "ستون دوم",
            ),
            ...matching[side].map((item, index) =>
              h(
                "div",
                { class: "matching-print-item", "data-matching-id": item.id },
                [
                  h(
                    "span",
                    { class: "matching-item-label" },
                    matchingLabel(side, index, language),
                  ),
                  h(
                    "div",
                    { class: "matching-item-content", dir: en ? "ltr" : "rtl" },
                    [rich(item.body)],
                  ),
                  h("span", { class: "matching-dot", "aria-hidden": "true" }),
                ],
              ),
            ),
          ],
        ),
      ),
      kind === "answer-key" &&
        h("svg", {
          class: "matching-connections",
          "aria-hidden": "true",
          preserveAspectRatio: "none",
        }),
    ],
  );
}
