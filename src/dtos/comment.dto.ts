import { MediaTypeEnum } from "../../generated/prisma/enums.ts";

export interface ICreateCommentBody {
    postPublicId: string;
    content: string;
    media: { url: string, type: MediaTypeEnum }[];
    parentPublicId?: string;
}

export interface IUpdateCommentBody {
    content: string;
    media: { url: string, type: MediaTypeEnum }[];
}