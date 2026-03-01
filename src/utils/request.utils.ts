import { Request } from "express";

export function getRouteParam(req: Request, key: string): string | null {
  const value = req.params[key] as string;
  if (!value) return null;
  return value;
}
