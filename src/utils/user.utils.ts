import { BIO_MAX_LENGTH, NAME_MAX_LENGTH, NAME_MIN_LENGTH } from "../constants.ts";

export const validateName = (name: string | null) => {
    if (!name) return { success: false, message: "Name is required" };
  
    if (name.length < NAME_MIN_LENGTH) return { success: false, message: "Name must be at least 2 characters" };
    if (name.length > NAME_MAX_LENGTH) return { success: false, message: "Name must be less than 25 characters" };
  
    return { success: true, message: "Name is valid" };
};

export const validateBio = (bio: string | null) => {
    if (!bio) return { success: true, message: "Bio is valid" };
    if (bio.length > BIO_MAX_LENGTH) return { success: false, message: "Bio must be less than 160 characters" };
  
    return { success: true, message: "Bio is valid" };
};