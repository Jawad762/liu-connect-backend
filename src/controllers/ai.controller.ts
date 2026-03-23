import { Response } from "express";
import { errorResponse, IAuthRequestBody, successResponse } from "../dtos/base.dto.ts";
import logger from "../lib/logger.ts";
import { openAiClient } from "../lib/openai.ts";
import { COURSE_CODE_REGEX, getAnalyzeSchedulePrompt, isValidAnalyzeScheduleResult, normalizeCourseCode } from "../utils/ai.utils.ts";
import { IAnalyzeScheduleResult } from "../dtos/ai.dto.ts";

export const analyzeSchedule = async (
  req: IAuthRequestBody<{ scheduleUrl: string }>,
  res: Response
) => {
  try {
    const { scheduleUrl } = req.body;
    if (!scheduleUrl) {
      return res.status(400).json(errorResponse("Schedule URL is required"));
    }

    const response = await openAiClient.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: getAnalyzeSchedulePrompt() },
            { type: "input_image", image_url: scheduleUrl, detail: "auto" },
          ],
        },
      ],
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      return res
        .status(422)
        .json(errorResponse("Model output was not valid JSON"));
    }

    if (!isValidAnalyzeScheduleResult(parsed)) {
      return res
        .status(422)
        .json(errorResponse("Model output shape is invalid"));
    }

    const courses = Array.from(
      new Set(
        parsed.courses
          .map(normalizeCourseCode)
          .filter((code) => COURSE_CODE_REGEX.test(code))
      )
    );

    const scheduleData: IAnalyzeScheduleResult = {
      ...parsed,
      name: parsed.name?.trim() ?? null,
      major: parsed.major?.trim() ?? null,
      campus: parsed.campus?.trim() ?? null,
      courses,
      needs_user_review:
        parsed.needs_user_review ||
        !parsed.name ||
        !parsed.major ||
        !parsed.campus ||
        courses.length === 0,
      warnings: parsed.warnings,
    };

    return res
      .status(200)
      .json(successResponse(scheduleData, "Schedule analyzed successfully"));
  } catch (error) {
    logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
    return res.status(500).json(errorResponse("Internal server error"));
  }
};