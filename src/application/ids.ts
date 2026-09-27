import { randomBytes } from "node:crypto";

export function generateOpaqueId(prefix: "conv" | "hd" | "shcap" | "creator"): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}
