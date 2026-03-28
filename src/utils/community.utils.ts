import { DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH, NAME_MIN_LENGTH } from "../constants.ts";

export const validateCommunityName = (name: string | null | undefined) => {
    if (!name) return { success: false, message: "Community name is required" };
    if (name.length < NAME_MIN_LENGTH) return { success: false, message: `Community name must be at least ${NAME_MIN_LENGTH} characters` };
    if (name.length > NAME_MAX_LENGTH) return { success: false, message: `Community name must be less than ${NAME_MAX_LENGTH} characters` };
    return { success: true, message: "Community name is valid" };
};

export const validateCommunityDescription = (description: string | null | undefined) => {
    if (!description) return { success: true, message: "Description is valid" };
    if (description.length > DESCRIPTION_MAX_LENGTH) return { success: false, message: `Description must be less than ${DESCRIPTION_MAX_LENGTH} characters` };
    return { success: true, message: "Description is valid" };
};
