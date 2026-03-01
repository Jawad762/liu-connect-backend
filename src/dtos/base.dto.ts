import { Request } from "express";

export interface IRequestBody<T> extends Request<{}, {}, T> {
  body: T;
}

export interface IAuthRequest extends Request {
  userId?: number;
  userPublicId?: string;
}

export interface IAuthRequestBody<T> extends IAuthRequest {
  body: T;
}

export interface IApiResponse<T = void> {
  success: boolean;
  message?: string;
  data?: T;
}

export const successResponse = <T>(data?: T, message?: string): IApiResponse<T> => ({
  success: true,
  ...(message && { message }),
  ...(data !== undefined && { data }),
});

export const errorResponse = (message: string): IApiResponse<never> => ({
  success: false,
  message,
});