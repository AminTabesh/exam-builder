import { defineComponent, h, useId } from "vue";
export function labeledField(Control) {
  return defineComponent({
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      const id = useId();
      return () =>
        h("div", { class: "labeled-field" }, [
          attrs.label &&
            h(
              "label",
              { for: attrs.id || id, class: "control-label" },
              attrs.label,
            ),
          h(
            Control,
            {
              ...attrs,
              id: attrs.id || id,
              label: undefined,
              singleLine: true,
            },
            slots,
          ),
        ]);
    },
  });
}
