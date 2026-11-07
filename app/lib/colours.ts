// Known flavours get their fruit colour; anything else gets a steady colour from its name.
const KNOWN: [RegExp, string][] = [
  [/mango/i, "#E8961E"],
  [/blueberr/i, "#5B4FC4"],
  [/strawberr/i, "#D9455F"],
  [/raspberr/i, "#C2306B"],
  [/pear/i, "#7FA632"],
  [/passion/i, "#8E44AD"],
  [/peach|apricot/i, "#F08A5D"],
  [/kiwi|lime|apple/i, "#4E9F3D"],
  [/lemon|banana|pineapple/i, "#D4A20B"],
  [/cherry/i, "#A4161A"],
];
const FALLBACK = ["#2A9D8F", "#E76F51", "#6D597A", "#3A86FF", "#B5838D", "#588157"];

export function colourFor(name: string) {
  for (const [re, c] of KNOWN) if (re.test(name)) return c;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
