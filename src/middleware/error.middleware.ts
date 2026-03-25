import type { NextFunction, Request, Response } from "express";
import { errorResponse } from "../dtos/base.dto.ts";
import logger from "../lib/logger.ts";

export function notFoundMiddleware(_req: Request, _res: Response, next: NextFunction) {
  next(new Error("Not Found"));
}

export function errorMiddleware(err: Error, req: Request, res: Response, _next: NextFunction) {
  const status = err.message === "Not Found" ? 404 : 500;
  const message = err.message === "Not Found" ? "Not found" : "Internal server error";

  logger.error(
    {
      err,
      method: req.method,
      path: req.path,
      status,
      requestId: req.requestId,
      userId: req.user?.id,
    },
    "Request error"
  );

  if (res.headersSent) return;
  res.status(status).json(errorResponse(message));
}

