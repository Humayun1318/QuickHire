import { Types } from 'mongoose';
import { CreateApplicationDTO, IApplication } from './Application.interface';
import { Job } from '../jobListing/jobListing.models';
import { Application } from './Application.models';

/**
 * Submit a job application
 */
const submitApplication = async (
  applicationData: CreateApplicationDTO,
): Promise<IApplication> => {
  if (!Types.ObjectId.isValid(applicationData.job_id)) {
    throw new Error('Invalid job ID format');
  }

  // Check if job exists
  const job = await Job.findById(applicationData.job_id);
  if (!job) {
    throw new Error('Job not found');
  }

  // Create application (unique constraint will prevent duplicates)
  const application = await Application.create({
    ...applicationData,
    email: applicationData.email.toLowerCase(),
  });

  return application;
};

/**
 * Get all applications for a specific job (Admin only)
 */
const getApplicationsByJobId = async (
  jobId: string,
): Promise<IApplication[]> => {
  if (!Types.ObjectId.isValid(jobId)) {
    throw new Error('Invalid job ID format');
  }

  const applications = await Application.find({ job_id: jobId }).sort({
    created_at: -1,
  });

  return applications;
};

/**
 * Get a single application by ID (Admin only)
 */
const getApplicationById = async (id: string): Promise<IApplication | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Invalid application ID format');
  }

  const application = await Application.findById(id);

  if (!application) {
    throw new Error('Application not found');
  }

  return application;
};

/**
 * Delete an application (Admin only)
 */
const deleteApplication = async (id: string): Promise<{ message: string }> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Invalid application ID format');
  }

  const application = await Application.findByIdAndDelete(id);

  if (!application) {
    throw new Error('Application not found');
  }

  return { message: 'Application deleted successfully' };
};

export const applicationService = {
  submitApplication,
  getApplicationsByJobId,
  getApplicationById,
  deleteApplication,
};
