export interface ICreatePostBody {
    content: string;
    communityPublicId: string;
    media: string[];
}

export interface ILikePostBody {
    postPublicId: string;
}