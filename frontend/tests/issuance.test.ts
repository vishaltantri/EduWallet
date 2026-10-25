import { describe, expect, it } from "vitest";
import { normalizeIssuance, parseIssuanceCsv, validateIssuance } from "@/lib/issuance";

describe("normalizeIssuance", () => {
  it("trims, lowercases the email, and drops blank optionals", () => {
    const result = normalizeIssuance({
      studentEmail: "  Jane@Example.COM ",
      studentName: "  Jane Smith  ",
      degreeType: " Bachelor of Science ",
      major: " Computer Science ",
      grade: "   ",
      completionDate: "",
    });

    expect(result).toEqual({
      studentEmail: "jane@example.com",
      studentName: "Jane Smith",
      degreeType: "Bachelor of Science",
      major: "Computer Science",
      grade: undefined,
      completionDate: undefined,
    });
  });

  it("coerces non-string input to empty strings rather than throwing", () => {
    const result = normalizeIssuance({
      studentEmail: 42 as never,
      studentName: null as never,
      degreeType: undefined,
      major: {} as never,
    });
    expect(result.studentEmail).toBe("");
    expect(result.studentName).toBe("");
    expect(result.major).toBe("");
  });
});

describe("validateIssuance", () => {
  const valid = {
    studentEmail: "jane@example.com",
    studentName: "Jane Smith",
    degreeType: "Bachelor of Science",
    major: "Computer Science",
  };

  it("accepts a complete request", () => {
    expect(validateIssuance(valid)).toBeNull();
  });

  it("requires every mandatory field", () => {
    for (const field of ["studentEmail", "studentName", "degreeType", "major"] as const) {
      expect(validateIssuance({ ...valid, [field]: "" })).toMatch(/required/i);
    }
  });

  it("rejects an email that is not an address", () => {
    for (const email of ["jane", "jane@", "@example.com", "jane example.com", "jane@example"]) {
      expect(validateIssuance({ ...valid, studentEmail: email })).toMatch(/not a valid email/i);
    }
  });

  it("caps the name and major length", () => {
    expect(validateIssuance({ ...valid, studentName: "x".repeat(121) })).toMatch(/120/);
    expect(validateIssuance({ ...valid, major: "x".repeat(121) })).toMatch(/120/);
    expect(validateIssuance({ ...valid, major: "x".repeat(120) })).toBeNull();
  });

  it("rejects an unparseable completion date but accepts a real one", () => {
    expect(validateIssuance({ ...valid, completionDate: "not-a-date" })).toMatch(/valid date/i);
    expect(validateIssuance({ ...valid, completionDate: "2026-05-30" })).toBeNull();
  });
});

describe("parseIssuanceCsv", () => {
  it("parses a minimal CSV", () => {
    const { rows, errors } = parseIssuanceCsv(
      ["email,name,degree,major", "jane@example.com,Jane Smith,Bachelor of Science,Computer Science"].join(
        "\n"
      )
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].studentName).toBe("Jane Smith");
  });

  it("accepts the documented column aliases in any order", () => {
    const { rows, errors } = parseIssuanceCsv(
      [
        "Field of Study,Student Name,Student Email,Degree Type,Grade,Completion",
        "Physics,Ravi Kumar,ravi@example.com,Master of Science,Distinction,2026-04-10",
      ].join("\n")
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toEqual({
      studentEmail: "ravi@example.com",
      studentName: "Ravi Kumar",
      degreeType: "Master of Science",
      major: "Physics",
      grade: "Distinction",
      completionDate: "2026-04-10",
    });
  });

  it("handles quoted fields containing commas and escaped quotes", () => {
    const { rows, errors } = parseIssuanceCsv(
      [
        "email,name,degree,major",
        '"a@b.com","Smith, Jane","Bachelor of Arts","Politics, Philosophy"',
        '"c@d.com","Ann ""Annie"" Lee","Diploma","Design"',
      ].join("\n")
    );
    expect(errors).toEqual([]);
    expect(rows[0].studentName).toBe("Smith, Jane");
    expect(rows[0].major).toBe("Politics, Philosophy");
    expect(rows[1].studentName).toBe('Ann "Annie" Lee');
  });

  it("reports missing required columns and parses nothing", () => {
    const { rows, errors } = parseIssuanceCsv("email,name\njane@example.com,Jane");
    expect(rows).toEqual([]);
    expect(errors).toEqual(
      expect.arrayContaining(["Missing required column: degree", "Missing required column: major"])
    );
  });

  it("rejects a CSV with no data rows", () => {
    expect(parseIssuanceCsv("email,name,degree,major").errors[0]).toMatch(/at least one/i);
    expect(parseIssuanceCsv("").errors[0]).toMatch(/at least one/i);
  });

  it("keeps good rows and reports bad ones by their line number", () => {
    const { rows, errors } = parseIssuanceCsv(
      [
        "email,name,degree,major",
        "ok@example.com,Good Row,Diploma,Design",
        "not-an-email,Bad Row,Diploma,Design",
        ",Missing Email,Diploma,Design",
      ].join("\n")
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].studentEmail).toBe("ok@example.com");
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/^Row 3:/);
    expect(errors[1]).toMatch(/^Row 4:/);
  });

  it("tolerates CRLF line endings and blank lines", () => {
    const { rows, errors } = parseIssuanceCsv(
      "email,name,degree,major\r\n\r\njane@example.com,Jane,Diploma,Design\r\n\r\n"
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  it("treats a short row's missing trailing columns as empty", () => {
    const { rows, errors } = parseIssuanceCsv(
      ["email,name,degree,major,grade", "jane@example.com,Jane,Diploma,Design"].join("\n")
    );
    expect(errors).toEqual([]);
    expect(rows[0].grade).toBeUndefined();
  });
});
