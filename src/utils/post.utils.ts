import { MediaTypeEnum } from "../../generated/prisma/enums.ts";
import { validateMediaItems } from "./media.utils.ts";
import { POST_CONTENT_MAX_LENGTH, POST_MEDIA_MAX_COUNT } from "../constants.ts";

export const validatePost = (content: string | undefined | null, media: { url: string, type: MediaTypeEnum }[]) => {
    const trimmed = content?.trim() ?? "";
    if (!trimmed.length && media.length === 0) return { success: false, message: "Post content or media items are required" };
    if (trimmed.length > POST_CONTENT_MAX_LENGTH) return { success: false, message: `Post content must be less than ${POST_CONTENT_MAX_LENGTH} characters` };
    if (media.length > POST_MEDIA_MAX_COUNT) return { success: false, message: `Maximum ${POST_MEDIA_MAX_COUNT} media allowed` };
    if (media.length > 0 && !validateMediaItems(media)) return { success: false, message: "Each media item must have a valid url and type" };
    return { success: true, message: "Post is valid" };   
};