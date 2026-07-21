const NAME = /^[A-Za-z0-9._-]{1,100}$/u;

class JobSubmissionError extends Error {
  constructor() {
    super('Catalyst did not accept the intelligence job.');
    this.name = 'JobSubmissionError';
    this.code = 'JOB_SUBMISSION_FAILED';
  }
}

export function createCatalystJobScheduler({ app, jobPoolName }) {
  if (typeof app?.jobScheduling !== 'function') throw new TypeError('Catalyst app with Job Scheduling is required.');
  if (typeof jobPoolName !== 'string' || !NAME.test(jobPoolName)) throw new TypeError('A valid Catalyst job pool name is required.');

  const pool = app.jobScheduling().jobpool({ name: jobPoolName });
  if (typeof pool?.submitJob !== 'function') throw new TypeError('Catalyst job pool is unavailable.');

  return Object.freeze({
    async submit({ runRequestId, batchKey, operation }) {
      try {
        const result = await pool.submitJob({
          job_name: `intelligence-${runRequestId}`,
          target_type: 'Function',
          target_name: 'intelligence_refresh',
          params: { operation, batchKey, runRequestId },
          job_config: { number_of_retries: 2, retry_interval: 900 },
        });
        if (typeof result?.job_id !== 'string' || !result.job_id) throw new JobSubmissionError();
        return Object.freeze({ jobId: result.job_id });
      } catch (error) {
        if (error?.code === 'JOB_SUBMISSION_FAILED') throw error;
        throw new JobSubmissionError();
      }
    },
  });
}
