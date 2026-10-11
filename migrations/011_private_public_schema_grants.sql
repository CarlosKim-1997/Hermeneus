-- Hermeneus uses direct server-side PostgreSQL connections, not Supabase Data API roles.
-- Revoke existing grants on Hermeneus objects and prevent automatic grants on future
-- objects created by the migration role. Keep unrelated public-schema objects intact.

REVOKE ALL PRIVILEGES ON TABLE
  public.schema_migrations,
  public.source_conversations,
  public.source_messages,
  public.handoffs,
  public.handoff_drafts,
  public.published_handoff_versions,
  public.share_capabilities,
  public.creators,
  public.creator_external_identities,
  public.published_handoff_provenance,
  public.verifier_pilot_budget
FROM PUBLIC;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC globally by default.
-- A schema-scoped default REVOKE cannot undo that global default.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

DO $$
DECLARE
  target_role TEXT;
  function_record RECORD;
BEGIN
  FOR target_role IN
    SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.schema_migrations, public.source_conversations, public.source_messages, public.handoffs, public.handoff_drafts, public.published_handoff_versions, public.share_capabilities, public.creators, public.creator_external_identities, public.published_handoff_provenance, public.verifier_pilot_budget FROM %I',
      target_role
    );
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', target_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', target_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I', target_role);
  END LOOP;

  FOR function_record IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'prevent_published_handoff_update',
        'share_capabilities_immutable_except_revoke',
        'handoffs_owner_immutable',
        'creator_external_identities_immutable',
        'prevent_published_provenance_update',
        'm12_assert_legacy_published_snapshot',
        'm12_assert_canonical_published_snapshot',
        'creators_lifecycle_monotonic',
        'creator_external_identities_lifecycle_guard'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC', function_record.proname, function_record.arguments);
    FOR target_role IN
      SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM %I', function_record.proname, function_record.arguments, target_role);
    END LOOP;
  END LOOP;
END;
$$;
