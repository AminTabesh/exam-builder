/** Normalize user-entered Persian and Arabic-Indic digits without changing other text. */
export function englishDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}
/** Display only: never apply to stored documents or API identifiers. */
export function persianDigits(value) {
  return englishDigits(value).replace(
    /[0-9]/g,
    (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)],
  );
}
