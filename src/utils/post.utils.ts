export const validateContent = (content: string) => {
    if (!content) return false;
    if (content.length < 1 || content.length > 300) return false;
    return true;
};