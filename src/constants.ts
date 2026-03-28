export const RATE_LIMIT_WINDOW_MS = 1 * 60 * 1000; // 1 minute
export const RATE_LIMIT_MAX = 100; // 100 requests per 15 minutes per IP
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const AUTH_RATE_LIMIT_MAX = 10; // 10 requests per 15 minutes per IP

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 50;

export const POST_CONTENT_MAX_LENGTH = 300;
export const POST_MEDIA_MAX_COUNT = 4;

export const COMMENT_CONTENT_MAX_LENGTH = 300;
export const COMMENT_MEDIA_MAX_COUNT = 4;

export const REPORT_DETAILS_MAX_LENGTH = 160;

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 25;
export const BIO_MAX_LENGTH = 160;
export const DESCRIPTION_MAX_LENGTH = 160;

export const LIU_MAJORS_BY_SCHOOL = {
    "School of Engineering": [
        "Bachelor of Science in Biomedical Engineering",
        "Computer Engineering",
        "Electrical Engineering",
        "Electronics Engineering",
        "Mechanical Engineering",
        "Surveying Engineering",
        "Communications Engineering",
        "Industrial Engineering",
        "Master of Science in Computer and Communication Engineering",
        "Master of Science in Electrical Engineering",
        "Master of Science in Electronics Engineering",
        "Master of Science in Biomedical Engineering",
        "Master of Science in Mechanical Engineering",
        "Master of Science in Surveying Engineering",
        "Master of Science in Industrial Engineering",
    ],
    "School of Pharmacy": [
        "Pharmacy",
        "Doctor of Pharmacy",
    ],
    "School of Education": [
        "Bachelor in Basic Education - English",
        "Bachelor in Basic Education - Mathematics",
        "Bachelor in Basic Education - Sciences",
        "Bachelor of Teaching English as a Foreign Language",
        "Bachelor of Education in Early Childhood Education",
        "Bachelor of Translation and Interpretation",
        "Master of Education in Teaching English as a Foreign Language",
        "Master of Education in Educational Management",
        "Teaching Diploma in Music",
        "Teaching Diploma in Computer Science",
        "Teaching Diploma in Drama and Performing Arts",
        "Teaching Diploma in Economics",
        "Teaching Diploma in Languages",
        "Teaching Diploma in Mathematics",
        "Teaching Diploma in Physical and Sports Education",
        "Teaching Diploma in Sciences",
        "Teaching Diploma in Sociology",
        "Teaching Diploma in Social Studies",
        "Teaching Diploma in Teaching Arts",
    ],
    "School of Business": [
        "Accounting",
        "Economics",
        "Financial Sciences",
        "Hotel and Tourism Management",
        "Business Management",
        "Management of Information Systems",
        "Marketing",
        "LIU-Worms International Business Management",
        "Master of Business Administration",
        "LIU-Worms Master of Business Administration",
    ],
    "School of Arts & Science": [
        "Bachelor of Communication Arts - Advertising",
        "Bachelor of Communication Arts - Journalism",
        "Bachelor of Communication Arts - Public Relations",
        "Bachelor of Communication Arts - Radio and Television",
        "Bachelor of Biochemistry",
        "Bachelor of Biology",
        "Bachelor of Biomedical Sciences",
        "Bachelor of Chemistry",
        "Bachelor of Computer Science",
        "Bachelor of Information Technology",
        "Bachelor of Food Technology",
        "Bachelor of Graphic Design",
        "Bachelor of Interior Design",
        "Bachelor of Mathematics",
        "Bachelor of Nutrition and Dietetics",
        "Bachelor of Physics",
        "Master of Computer Science",
        "Master of Food Technology",
        "Master of Science in Applied Mathematics",
    ],
} as const;

export type LiusSchool = keyof typeof LIU_MAJORS_BY_SCHOOL;

export type LiusMajor = (typeof LIU_MAJORS_BY_SCHOOL)[LiusSchool][number];

export const LIU_SCHOOL_OPTIONS: LiusSchool[] = Object.keys(
    LIU_MAJORS_BY_SCHOOL
) as LiusSchool[];

export const LIU_MAJOR_OPTIONS: { school: LiusSchool; major: LiusMajor }[] =
    LIU_SCHOOL_OPTIONS.flatMap((school) =>
        LIU_MAJORS_BY_SCHOOL[school].map((major) => ({ school, major }))
    );
