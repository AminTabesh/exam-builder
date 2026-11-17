import { readFile } from "node:fs/promises";
import * as fontkit from "fontkit";

// Build a reproducible regression font from the existing OFL KaTeX fixture.
// Context substitution permits a NULL SubRuleSet; fontkit's shaper throws on it.
// No private or commercial font files are copied into the repository.
export async function legacyContextFont() {
  const original = await readFile(
    new URL(
      "../../node_modules/katex/dist/fonts/KaTeX_Main-Regular.ttf",
      import.meta.url,
    ),
  );
  const glyph = fontkit
    .create(original)
    .glyphForCodePoint("E".codePointAt(0)).id;
  const gsub = Buffer.alloc(70);
  gsub.writeUInt32BE(0x10000, 0);
  gsub.writeUInt16BE(10, 4);
  gsub.writeUInt16BE(30, 6);
  gsub.writeUInt16BE(44, 8);
  gsub.writeUInt16BE(1, 10);
  gsub.write("DFLT", 12);
  gsub.writeUInt16BE(8, 16);
  gsub.writeUInt16BE(4, 18);
  gsub.writeUInt16BE(0xffff, 24);
  gsub.writeUInt16BE(1, 26);
  gsub.writeUInt16BE(1, 30);
  gsub.write("liga", 32);
  gsub.writeUInt16BE(8, 36);
  gsub.writeUInt16BE(1, 40);
  gsub.writeUInt16BE(1, 44);
  gsub.writeUInt16BE(4, 46);
  gsub.writeUInt16BE(5, 48);
  gsub.writeUInt16BE(1, 52);
  gsub.writeUInt16BE(8, 54);
  gsub.writeUInt16BE(1, 56);
  gsub.writeUInt16BE(8, 58);
  gsub.writeUInt16BE(1, 60);
  gsub.writeUInt16BE(1, 64);
  gsub.writeUInt16BE(1, 66);
  gsub.writeUInt16BE(glyph, 68);
  const tables = new Map();
  for (let i = 0; i < original.readUInt16BE(4); i++) {
    const pos = 12 + 16 * i,
      tag = original.toString("ascii", pos, pos + 4),
      offset = original.readUInt32BE(pos + 8),
      length = original.readUInt32BE(pos + 12);
    tables.set(tag, Buffer.from(original.subarray(offset, offset + length)));
  }
  tables.set("GSUB", gsub);
  tables.get("head").writeUInt32BE(0, 8);
  const entries = [...tables].sort(([a], [b]) => a.localeCompare(b));
  let length = 12 + entries.length * 16;
  for (const [, data] of entries) length += (data.length + 3) & ~3;
  const output = Buffer.alloc(length);
  original.copy(output, 0, 0, 4);
  output.writeUInt16BE(entries.length, 4);
  const power = Math.floor(Math.log2(entries.length));
  output.writeUInt16BE(16 * 2 ** power, 6);
  output.writeUInt16BE(power, 8);
  output.writeUInt16BE(entries.length * 16 - 16 * 2 ** power, 10);
  let offset = 12 + entries.length * 16,
    headOffset;
  const checksum = (data) => {
    let sum = 0;
    for (let i = 0; i < data.length; i += 4)
      sum = (sum + data.readUInt32BE(i)) >>> 0;
    return sum;
  };
  entries.forEach(([tag, data], i) => {
    const pos = 12 + i * 16,
      padded = Buffer.alloc((data.length + 3) & ~3);
    data.copy(padded);
    output.write(tag, pos);
    output.writeUInt32BE(checksum(padded), pos + 4);
    output.writeUInt32BE(offset, pos + 8);
    output.writeUInt32BE(data.length, pos + 12);
    padded.copy(output, offset);
    if (tag === "head") headOffset = offset;
    offset += padded.length;
  });
  output.writeUInt32BE((0xb1b0afba - checksum(output)) >>> 0, headOffset + 8);
  return output;
}
