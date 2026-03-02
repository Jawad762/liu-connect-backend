export interface ICreateCommentBody {
    postPublicId: string;
    content: string;
    media: string[];
    parentPublicId?: string;
}

export interface IUpdateCommentBody {
    content: string;
    media: string[];
}