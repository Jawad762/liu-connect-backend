import { MediaTypeEnum } from "../../generated/prisma/enums.ts";

export interface ICreateCommentBody {
    postId: string;
    content: string;
    media: { url: string, type: MediaTypeEnum }[];
    parentCommentId?: string;
}

export interface IUpdateCommentBody {
    content: string;
    media: { url: string, type: MediaTypeEnum }[];
}

export interface IReportCommentBody {
    reason: string;
    details: string | null;
}