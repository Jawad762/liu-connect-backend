import { MediaTypeEnum } from "../../generated/prisma/enums.ts";

const VALID_MEDIA_TYPES = Object.values(MediaTypeEnum);

export const validateMediaItems = (media: { url: string; type: string }[]) => {
    if (!Array.isArray(media)) return false;
    return media.every(
        (m) =>
            validateUrl(m.url).success &&
            validateMediaType(m.type).success
    );
};

export const validateUrl = (url: string | null) => {
    if (!url || !url.startsWith("https://")) return { success: false, message: "Invalid URL" };
    return { success: true, message: "URL is valid" };
};

export const validateMediaType = (type: string) => {
    if (!VALID_MEDIA_TYPES.includes(type as MediaTypeEnum)) return { success: false, message: "Invalid media type" };
    return { success: true, message: "Media type is valid" };
};