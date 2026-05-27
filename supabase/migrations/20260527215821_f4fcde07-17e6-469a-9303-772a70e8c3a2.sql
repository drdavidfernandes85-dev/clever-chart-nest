ALTER TABLE public.controlled_retest_authorisations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'authorised',
  ADD COLUMN IF NOT EXISTS armed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS dispatch_attempted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.controlled_retest_authorisations
SET armed_at = COALESCE(armed_at, authorised_at)
WHERE armed_at IS NULL;

UPDATE public.controlled_retest_authorisations
SET status = 'revoked_after_pretrade_block_review',
    dispatch_attempted_at = COALESCE(
      dispatch_attempted_at,
      NULLIF(outcome_payload->>'dispatchAttemptedAt', '')::timestamp with time zone,
      updated_at
    ),
    evidence_json = COALESCE(evidence_json, '{}'::jsonb) || jsonb_build_object(
      'mutationDispatched', false,
      'brokerMutationDispatched', false,
      'doesNotCountAsBrokerSideTest', true,
      'reviewRequired', true,
      'blockedStage', COALESCE(outcome_payload->>'blockedStage', 'mapping_validation'),
      'blockedCode', COALESCE(outcome_payload->>'blockedCode', outcome_payload->>'code', 'MAPPING_NOT_ACTIVE')
    )
WHERE outcome = 'pretrade_blocked'
  AND consumed_at IS NULL
  AND status = 'authorised';