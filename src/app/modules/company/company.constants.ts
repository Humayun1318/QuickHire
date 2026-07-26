

export const COMPANY_NOT_FOUND = 'Company not found';
export const COMPANY_ALREADY_EXISTS =
    'You have already created a company. Each employer can only own one company.';
export const COMPANY_SLUG_TAKEN =
    'A company with this name already exists. Please choose a different name.';

// Industry categories — fixed list prevents inconsistent free-text entries
// like "tech", "IT", "Information Technology" meaning the same thing
export enum CompanyIndustry {
    TECHNOLOGY = 'Technology',
    FINANCE = 'Finance',
    HEALTHCARE = 'Healthcare',
    EDUCATION = 'Education',
    ECOMMERCE = 'E-Commerce',
    MEDIA = 'Media & Entertainment',
    MANUFACTURING = 'Manufacturing',
    REAL_ESTATE = 'Real Estate',
    LOGISTICS = 'Logistics & Supply Chain',
    TELECOM = 'Telecommunications',
    CONSULTING = 'Consulting',
    NGO = 'NGO / Non-Profit',
    GOVERNMENT = 'Government',
    OTHER = 'Other',
}

// Company size ranges — used for employer search filtering
export enum CompanySize {
    MICRO = '1-10',
    SMALL = '11-50',
    MEDIUM = '51-200',
    LARGE = '201-500',
    ENTERPRISE = '500+',
}

// Verification status — admin-controlled, affects trust badge on UI
export enum CompanyVerificationStatus {
    UNVERIFIED = 'unverified', // default on creation
    PENDING = 'pending',    // employer submitted docs, awaiting admin review
    VERIFIED = 'verified',   // admin approved
    REJECTED = 'rejected',   // admin rejected with reason
}