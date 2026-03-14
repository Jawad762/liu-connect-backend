import { MediaTypeEnum } from "../../generated/prisma/enums.ts";

export interface ICreatePostBody {
    content: string;
    communityId: string;
    media: { url: string, type: MediaTypeEnum }[];
}

export interface ILikePostBody {
    postId: string;
}

export interface IUpdatePostBody {
    content: string;
    media: { url: string, type: MediaTypeEnum }[];
}