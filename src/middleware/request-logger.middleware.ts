import type { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import logger from "../lib/logger.ts";

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  req.requestId = crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);

  const start = process.hrtime.bigint();
  const path = req.originalUrl ?? req.url;

  res.on("finish", () => {
    if (path.startsWith("/api/health")) return;

    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        path,
        status: res.statusCode,
        duration_ms: Math.round(durationMs),
        userId: req.user?.id,
      },
      "Request"
    );
  });

  next();
}

