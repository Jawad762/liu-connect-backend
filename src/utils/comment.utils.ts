import { MediaTypeEnum } from "../../generated/prisma/enums.ts";
import { validateMediaItems } from "./media.utils.ts";
import { COMMENT_CONTENT_MAX_LENGTH, COMMENT_MEDIA_MAX_COUNT } from "../constants.ts";

export const validateComment = (content: string | undefined | null, media: { url: string, type: MediaTypeEnum }[]) => {
    const trimmed = content?.trim() ?? "";
    if (!trimmed.length && media.length === 0) return { success: false, message: "Comment content or media items are required" };
    if (trimmed.length > COMMENT_CONTENT_MAX_LENGTH) return { success: false, message: `Comment content must be less than ${COMMENT_CONTENT_MAX_LENGTH} characters` };
    if (media.length > COMMENT_MEDIA_MAX_COUNT) return { success: false, message: `Maximum ${COMMENT_MEDIA_MAX_COUNT} media items allowed` };
    if (media.length > 0 && !validateMediaItems(media)) return { success: false, message: "Each media item must have a valid url and type" };
    return { success: true, message: "Comment is valid" };
};
