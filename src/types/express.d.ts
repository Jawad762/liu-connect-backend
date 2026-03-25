import type { IAuthUser } from "../dtos/auth.dto.ts";

declare global {
  namespace Express {
    interface Request {
      user: Partial<IAuthUser>;
      requestId?: string;
    }
  }
}

export {};

