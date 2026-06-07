# AIPM Synthtrace Scenarios

This directory is the plugin-local home for synthetic data generation used by
the AIPM showcase.

The scenarios here should teach both humans and agents how to seed the data that
backs:

- the Playground UI
- future session-reconstruction views
- embeddable widgets
- Agent Builder and MCP-facing investigation flows

## Scenario design rules

Each scenario should document:

1. what question or concern it is meant to exercise
2. which source tier it targets:
   - `otel`
   - `enriched_otel`
   - `sdk_enriched`
3. which data roles it emits:
   - `runtime`
   - `integration`
   - `evaluation`
4. whether it includes correlated APM context
5. any privacy-sensitive fields it emits, such as raw prompts or tool arguments

## Implemented scenario families

The current Task `003` implementation is organized into these scenario files:

- `playground_routing_and_cost.ts`
  covers Playground traffic, model routing, side-by-side comparison, and cost
  pressure
- `quality_eval_release_gating.ts`
  covers offline evals, quality regression, human review, and release gates
- `session_reconstruction_audit.ts`
  covers ordered multi-turn sessions, audit trails, and prompt redaction
- `tool_retrieval_mcp_orchestration.ts`
  covers successful tool use, MCP fan-out, tool argument hallucination, and
  cascading context errors
- `provider_runtime_and_schema_drift.ts`
  covers throttling, truncation, missing eval events, telemetry drops, and
  schema drift
- `cross_signal_rollout_capacity.ts`
  covers deployment regressions, infra pressure, and cross-signal capacity
  debugging
- `semantic_failures.ts`
  covers infinite reasoning loops, semantic goal drift, and forgotten terminal
  actions
- `indirect_prompt_injection.ts`
  covers prompt injection, unsafe tool targets, secret exposure risk, and
  guardrail decisions

## How to run a scenario by path

Until a short alias is registered in
`src/platform/packages/shared/kbn-synthtrace/src/cli/utils/parse_run_cli_flags.ts`,
run scenarios by file path:

```bash
node scripts/synthtrace \
  ./x-pack/solutions/observability/plugins/aipm/test/scenarios/<scenario>.ts \
  --target=http://elastic:changeme@localhost:9200 \
  --kibana=http://elastic:changeme@localhost:5601
```

If your local stack uses authentication or HTTPS, pass the appropriate target,
credentials, and `--insecure` flag as needed.

## How to run a scenario by alias

Once an alias is added to `SCENARIO_ALIASES`, the shorter form becomes:

```bash
node scripts/synthtrace <alias> \
  --target=http://elastic:changeme@localhost:9200 \
  --kibana=http://elastic:changeme@localhost:5601
```

## README expectations for each scenario

If a scenario grows beyond a trivial single-file case, add or update a local
README section that explains:

- why the scenario exists
- which business and SRE concerns it covers
- what the expected UI outcome is
- how a human should validate the data after ingestion

## Validation notes

After ingestion, validate at least the following:

1. traces land in the APM-backed OTel data stream and show `gen_ai.*` fields
2. session logs can be queried by `session.id` and sorted by `event.sequence`
3. cross-signal scenarios show both AI traces and infra or log evidence
4. failure-mode scenarios produce a mix of runtime errors and semantic failures

## Known local-stack behavior

On the current local stack, OTel-based synthtrace scenarios can produce `409`
conflicts on derived `transaction.60m.otel` or `service_destination.60m.otel`
metric documents.

This same behavior was reproduced with the existing upstream
`otel_simple_trace` scenario, so treat it as inherited local synthtrace or OTel
metric behavior unless the run also shows `400`-class mapping or parsing
failures.
