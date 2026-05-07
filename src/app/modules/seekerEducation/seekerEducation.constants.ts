

export const EDUCATION_NOT_FOUND = 'Education record not found';
export const EDUCATION_NOT_OWNED =
    'You do not have permission to modify this education record';

// Degree types — fixed enum prevents inconsistent data like "bsc" vs "B.Sc" vs "Bachelor"
export enum DegreeType {
    SSC = 'SSC',
    HSC = 'HSC',
    DIPLOMA = 'Diploma',
    BACHELOR = 'Bachelor',
    MASTER = 'Master',
    PHD = 'PhD',
    OTHER = 'Other',
}

// Points added to profile completeness when first education is added
export const EDUCATION_COMPLETENESS_POINTS = 15;