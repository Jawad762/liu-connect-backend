import { BIO_MAX_LENGTH, LIU_MAJOR_OPTIONS, LiusSchool, NAME_MAX_LENGTH, NAME_MIN_LENGTH, LIU_SCHOOL_OPTIONS } from "../constants.ts";

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

export const validateSchool = (school: string | null) => {
    if (!school || !LIU_SCHOOL_OPTIONS.includes(school as LiusSchool)) return { success: false, message: "Invalid school" };
    return { success: true, message: "School is valid" };
};

export const validateMajor = (major: string | null) => {
    if (!major || !LIU_MAJOR_OPTIONS.some((option) => option.major === major)) return { success: false, message: "Invalid major" };
    return { success: true, message: "Major is valid" };
};