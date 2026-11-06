export type Course = {
    id: string;
    name: string;
    courseNumber: string;
    professor: string;
    subject: string;
    year: number;
};

export type CourseSearchFilters = {
    subject: string;
    courseNumber: string;
    professor: string;
    year: string;
};
