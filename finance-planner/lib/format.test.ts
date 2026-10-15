import { describe, expect, it } from "vitest";
import { formatINR } from "./format";
import { financialYearOf } from "./calc/financialYear";
import { toCsv, sectionsToCsv } from "./export";

describe("formatINR", () => {
  it("uses the Indian digit grouping", () => {
    expect(formatINR(1234567)).toBe("₹12,34,567");
    expect(formatINR(999)).toBe("₹999");
    expect(formatINR(10000000)).toBe("₹1,00,00,000");
  });
});

describe("financialYearOf", () => {
  it("starts in April", () => {
    expect(financialYearOf(new Date(2026, 3, 1))).toBe("2026-27");
    expect(financialYearOf(new Date(2026, 2, 31))).toBe("2025-26");
    expect(financialYearOf(new Date(2099, 11, 31))).toBe("2099-00");
  });
});

describe("csv export", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(toCsv([{ a: "x,y", b: 'say "hi"' }])).toBe('a,b\n"x,y","say ""hi"""');
    expect(toCsv([])).toBe("");
  });
  it("titles each section", () => {
    expect(sectionsToCsv({ goals: [{ n: 1 }] })).toBe("# goals\nn\n1");
  });
});
