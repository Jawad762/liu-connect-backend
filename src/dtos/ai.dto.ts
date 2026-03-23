export interface IAnalyzeScheduleResult {
  name: string | null;
  major: string | null;
  campus: string | null;
  courses: string[];
  needs_user_review: boolean;
  warnings: string[];
}