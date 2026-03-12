import { MediaTypeEnum } from "../../generated/prisma/enums.ts";

const VALID_MEDIA_TYPES = Object.values(MediaTypeEnum);

export const validateMediaItems = (media: { url: string; type: string }[]) => {
    if (!Array.isArray(media)) return false;
    return media.every(
        (m) =>
            typeof m?.url === "string" &&
            m.url.length > 0 &&
            typeof m?.type === "string" &&
            VALID_MEDIA_TYPES.includes(m.type as MediaTypeEnum)
    );
};