export interface ICreatePostBody {
    content: string;
    communityPublicId: string;
    media: string[];
}

export interface ILikePostBody {
    publicId: string;
}

export interface IUpdatePostBody {
    content: string;
    media: string[];
}