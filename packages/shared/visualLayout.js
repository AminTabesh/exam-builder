export function visualStyle(attrs = {}, type = "image") {
  const wrap = attrs.wrap || "none",
    align = attrs.imageAlign || "start";
  return {
    width: attrs.width
      ? `${attrs.width}px`
      : type === "image"
        ? "240px"
        : type === "drawing"
          ? `${attrs.drawing?.width || 600}px`
          : "400px",
    maxWidth: "100%",
    float: wrap === "none" ? "none" : wrap,
    marginTop: "8px",
    marginBottom: "8px",
    marginLeft:
      wrap === "right"
        ? "12px"
        : wrap === "left"
          ? "0"
          : align === "center"
            ? "auto"
            : "",
    marginRight:
      wrap === "left"
        ? "12px"
        : wrap === "right"
          ? "0"
          : align === "center"
            ? "auto"
            : "",
    marginInlineStart: wrap === "none" && align === "end" ? "auto" : "",
    marginInlineEnd: wrap === "none" && align === "start" ? "auto" : "",
  };
}
