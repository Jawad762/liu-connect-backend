import { ReportReason } from "../../generated/prisma/enums.ts";
import { REPORT_DETAILS_MAX_LENGTH } from "../constants.ts";

export const validateReportReason = (reason: string | null) => {
    if (!reason) return { success: false, message: "Reason is required" };
    if (!Object.values(ReportReason).includes(reason as ReportReason)) return { success: false, message: "Invalid reason" };
    return { success: true, message: "Reason is valid" };
};

export const validateReportDetails = (details: string) => {
    if (details.length > REPORT_DETAILS_MAX_LENGTH) return { success: false, message: `Details must be less than ${REPORT_DETAILS_MAX_LENGTH} characters` };
    return { success: true, message: "Details are valid" };
};
