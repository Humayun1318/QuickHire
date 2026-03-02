import { Types } from 'mongoose';
import { CreateJobDTO, IJob, JobQueryParams, UpdateJobDTO } from './jobListing.interface';
import { Job } from './jobListing.models';
import { Application } from '../Application/Application.models';



/**
 * Create a new job listing (Admin only)
 */
const createJobListing = async (jobData: CreateJobDTO): Promise<IJob> => {
  const job = await Job.create(jobData);
  return job;
};

/**
 * Get all job listings with optional filtering
 */
const getAllJobListing = async (
  query: JobQueryParams = {},
): Promise<IJob[]> => {
  const { category, location, search } = query;
  const filter: any = {};

  if (category) filter.category = category;
  if (location) filter.location = location;
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
    ];
  }

  const jobs = await Job.find(filter).sort({ created_at: -1 });
  return jobs;
};

/**
 * Get a single job listing by ID
 */
const getJobListingById = async (id: string): Promise<IJob | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Invalid job ID format');
  }

  const job = await Job.findById(id);
  if (!job) {
    throw new Error('Job not found');
  }
  return job;
};

/**
 * Update a job listing (Admin only)
 */
const updateJobListing = async (
  id: string,
  updateData: UpdateJobDTO,
): Promise<IJob | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Invalid job ID format');
  }

  const job = await Job.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!job) {
    throw new Error('Job not found');
  }

  return job;
};

/**
 * Delete a job listing (Admin only)
 */
const deleteJobListing = async (id: string): Promise<IJob> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Invalid job ID format');
  }

  // Delete all applications associated with this job first
  await Application.deleteMany({ job_id: id });

  const job = await Job.findByIdAndDelete(id);

  if (!job) {
    throw new Error('Job not found');
  }

  return job;
};

export const jobListingService = {
  createJobListing,
  getAllJobListing,
  getJobListingById,
  updateJobListing,
  deleteJobListing,
};
