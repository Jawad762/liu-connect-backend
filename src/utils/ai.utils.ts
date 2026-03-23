import { IAnalyzeScheduleResult } from "../dtos/ai.dto.ts";

export const getAnalyzeSchedulePrompt = () => {
    return `
        Extract LIU schedule data from this image.

        Return ONLY valid JSON (no markdown, no explanation, no extra text).

        JSON schema:
        {
        "name": string | null,
        "major": string | null,
        "campus": string | null,
        "courses": string[],
        "needs_user_review": boolean,
        "warnings": string[]
        }

        Rules:
        1) Extract only visible data from the image. Do not guess or invent values.
        2) If name/major/campus are missing or unclear, return null.
        3) "courses" must contain unique course codes only (example: "CSCI362", "MATH201").
        4) Normalize course codes to uppercase and remove spaces/hyphens where possible.
        5) Ignore sections, instructors, rooms, and times.
        6) If no reliable course code is found, return an empty array.
        7) Set needs_user_review=true if any of name/major/campus is null, or if courses is empty, or if text quality is poor.
        8) Add short warning messages for any missing/uncertain fields.

        Output must be strict JSON.
    `;
};

export const COURSE_CODE_REGEX = /^[A-Z]{3,5}\d{3,4}$/;

export const normalizeCourseCode = (value: string) =>
  value.toUpperCase().replace(/[\s-]/g, "");

export const isValidAnalyzeScheduleResult = (data: unknown): data is IAnalyzeScheduleResult => {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;

  const isNullableString = (v: unknown) => v === null || typeof v === "string";

  return (
    isNullableString(d.name) &&
    isNullableString(d.major) &&
    isNullableString(d.campus) &&
    Array.isArray(d.courses) &&
    d.courses.every((c) => typeof c === "string") &&
    typeof d.needs_user_review === "boolean" &&
    Array.isArray(d.warnings) &&
    d.warnings.every((w) => typeof w === "string")
  );
};