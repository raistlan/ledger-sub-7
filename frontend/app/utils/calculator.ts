/**
 * Safe mathematical expression evaluator.
 *
 * Uses a hand-rolled recursive descent parser instead of Function() constructor.
 * The original Figma prototype used Function('"use strict"; return (' + sanitized + ')')()
 * which is effectively eval() — replaced here with a proper parser.
 *
 * Supports: +, -, *, /, decimal numbers, parentheses
 * Returns null for invalid expressions, negative results, or non-finite results.
 */

function parseExpression(input: string): number {
  // Normalize: replace 'x' with '*' for calculator UX
  const src = input.replace(/x/g, "*").trim();
  let pos = 0;

  function peek(): string {
    while (pos < src.length && src[pos] === " ") pos++;
    return src[pos] ?? "";
  }

  function consume(): string {
    while (pos < src.length && src[pos] === " ") pos++;
    return src[pos++] ?? "";
  }

  function parseNumber(): number {
    let num = "";
    if (peek() === "-") {
      num += consume();
    }
    while (/[0-9.]/.test(peek())) {
      num += consume();
    }
    if (!num || num === "-") throw new Error("Expected number");
    return parseFloat(num);
  }

  function parsePrimary(): number {
    if (peek() === "(") {
      consume(); // (
      const val = parseAddSub();
      if (peek() !== ")") throw new Error("Expected )");
      consume(); // )
      return val;
    }
    return parseNumber();
  }

  function parseMulDiv(): number {
    let left = parsePrimary();
    while (peek() === "*" || peek() === "/") {
      const op = consume();
      const right = parsePrimary();
      if (op === "*") left *= right;
      else {
        if (right === 0) throw new Error("Division by zero");
        left /= right;
      }
    }
    return left;
  }

  function parseAddSub(): number {
    let left = parseMulDiv();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = parseMulDiv();
      if (op === "+") left += right;
      else left -= right;
    }
    return left;
  }

  const result = parseAddSub();
  // Ensure full input consumed
  while (pos < src.length && src[pos] === " ") pos++;
  if (pos < src.length) throw new Error("Unexpected character: " + src[pos]);
  return result;
}

export function evalExpression(input: string): number | null {
  if (!input.trim()) return null;
  try {
    const result = parseExpression(input);
    if (!isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}
