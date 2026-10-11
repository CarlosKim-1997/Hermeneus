// RFC 8785 JSON Canonicalization Scheme for I-JSON values. JSON.stringify
// provides ECMAScript primitive serialization; object keys are sorted by
// UTF-16 code units, arrays retain order, and invalid Unicode is rejected.
function assertUnicode(value: string): void {
  for (let i = 0; i < value.length; i += 1) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error("Invalid Unicode surrogate");
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new Error("Invalid Unicode surrogate");
    }
  }
}

export function jcs(value: unknown): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") { assertUnicode(value); return JSON.stringify(value); }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("JCS requires finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(jcs).join(",")}]`;
  if (typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new Error("JCS requires plain JSON objects");
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => {
      assertUnicode(key);
      if (record[key] === undefined) throw new Error("Undefined is not JSON");
      return `${JSON.stringify(key)}:${jcs(record[key])}`;
    }).join(",")}}`;
  }
  throw new Error("Unsupported JSON value");
}
