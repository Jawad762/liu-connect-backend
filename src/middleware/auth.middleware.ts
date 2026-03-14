import { Request, Response } from "express";
import { NextFunction } from "express";
import jwt, { JwtPayload } from 'jsonwebtoken';
import config from "../config.ts";
import { errorResponse } from "../dtos/base.dto.ts";
import { IAuthUser } from "../dtos/auth.dto.ts";

declare global {
  namespace Express {
    interface Request {
      user: Partial<IAuthUser>;
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json(errorResponse('Unauthorized'));
  }
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, config.ACCESS_TOKEN_SECRET) as JwtPayload;
    const user = {
      id: decoded.id,
      name: decoded.name
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json(errorResponse('Unauthorized'));
  }
};