import { MediaTypeEnum } from "../../generated/prisma/enums.ts";

export interface ICreatePostBody {
    content: string;
    communityPublicId: string;
    media: { url: string, type: MediaTypeEnum }[];
}

export interface ILikePostBody {
    publicId: string;
}

export interface IUpdatePostBody {
    content: string;
    media: { url: string, type: MediaTypeEnum }[];
}