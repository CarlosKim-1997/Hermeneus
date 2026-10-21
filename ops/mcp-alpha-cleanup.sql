-- T-034 operational provisioning for dzaibwrrylxlrxbgnyaw only.
-- Not a portable app migration. Run after migration 012 as the target operator.
-- No answer, question, consent, token or Canon bodies enter this job.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('hermeneus-mcp-metadata-cleanup','*/15 * * * *',$job$
DO $cleanup$
DECLARE cutoff bigint := floor(extract(epoch FROM clock_timestamp())*1000);
BEGIN
 DELETE FROM public.mcp_oauth_transactions WHERE expires_at<=cutoff;
 DELETE FROM public.mcp_oauth_codes WHERE expires_at<=cutoff OR consumed_at IS NOT NULL;
 DELETE FROM public.mcp_oauth_sessions WHERE expires_at<=cutoff OR revoked_at IS NOT NULL;
 DELETE FROM public.mcp_web_approvals WHERE expires_at<=cutoff OR consumed_at IS NOT NULL;
 DELETE FROM public.mcp_widget_tickets WHERE expires_at<=cutoff OR consumed_at IS NOT NULL;
 DELETE FROM public.mcp_delegations WHERE expires_at<=cutoff OR revoked_at IS NOT NULL;
 DELETE FROM cron.job_run_details WHERE jobid=(SELECT jobid FROM cron.job WHERE jobname='hermeneus-mcp-metadata-cleanup') AND end_time<clock_timestamp()-interval '24 hours';
END $cleanup$;
$job$);
