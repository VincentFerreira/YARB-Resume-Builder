import React from 'react';
import { useParams } from 'react-router-dom';
import JobDetail from '../components/jobs/JobDetail';

const JobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  if (!jobId) return null;
  return <JobDetail jobId={jobId} />;
};

export default JobDetailPage;
