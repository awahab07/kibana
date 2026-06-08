/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createHash } from 'crypto';
import { apm, type ApmOtelFields, type LogDocument } from '@kbn/synthtrace-client';
import { ApmSynthtracePipelineSchema } from '@kbn/synthtrace-client';
import { getSynthtraceEnvironment, type Scenario, withClient } from '@kbn/synthtrace';
import {
  buildEvaluationSpan,
  buildInternalSpan,
  buildModelCallSpan,
  buildSessionLogs,
  buildToolSpan,
  buildWorkflowRoot,
  createStoryIdentifiers,
  nextToolCallId,
  storyTraceLabel,
} from './helpers/aipm_story_helpers';

const ENVIRONMENT = getSynthtraceEnvironment(__filename);
const STORY_ID = 'aipm-fullstack-llm-journey';

type UserRating = 'thumbs_up' | 'thumbs_down';

interface JourneyVariant {
  id: string;
  promptText: string;
  rootOutcome: 'success' | 'failure';
  guardrailCategory: string;
  guardrailOutcome: 'success' | 'failure';
  guardrailSummary: string;
  guardrailAction: 'allow' | 'rewrite' | 'warn';
  plannerInputTokens: number;
  plannerOutputTokens: number;
  plannerCost: number;
  plannerDuration: number;
  plannerOutput: string;
  retrievalDuration: number;
  retrievalDocuments: number;
  retrievalQuality: string;
  retrievalSummary: string;
  toolOutcome: 'success' | 'failure';
  toolName: string;
  toolArguments: Record<string, unknown>;
  toolSummary: string;
  mcpServerName: string;
  mcpCallCount: number;
  mcpDuration: number;
  mcpSummary: string;
  customerProfileDuration: number;
  customerProfileSummary: string;
  entitlementsDuration: number;
  entitlementsOutcome: 'success' | 'failure';
  entitlementsSummary: string;
  billingDuration: number;
  billingOutcome: 'success' | 'failure';
  billingSummary: string;
  answerInputTokens: number;
  answerOutputTokens: number;
  answerCost: number;
  answerDuration: number;
  answerText: string;
  answerSummary: string;
  evalScore: number;
  evalLabel: string;
  evalOutcome: 'success' | 'failure';
  userRating: UserRating;
  feedbackComment: string;
  totalDuration: number;
  workflowWarning?: string;
}

const variants: JourneyVariant[] = [
  {
    id: 'happy-path-renewal',
    promptText:
      'Pause my annual support subscription for July, confirm whether I still qualify for premium routing, and tell me if there is any overdue balance.',
    rootOutcome: 'success',
    guardrailCategory: 'allow',
    guardrailOutcome: 'success',
    guardrailSummary: 'Prompt passed unchanged after entitlement-safe inspection.',
    guardrailAction: 'allow',
    plannerInputTokens: 540,
    plannerOutputTokens: 122,
    plannerCost: 0.011,
    plannerDuration: 360,
    plannerOutput:
      'Need customer profile, entitlement pause window, and outstanding balance before answering.',
    retrievalDuration: 150,
    retrievalDocuments: 7,
    retrievalQuality: 'grounded',
    retrievalSummary:
      'Fetched seven grounded documents from the customer operations knowledge base.',
    toolOutcome: 'success',
    toolName: 'lookup_customer_account_bundle',
    toolArguments: {
      customer_uuid: 'cust_001481',
      requested_action: 'pause_subscription',
      include_balance: true,
    },
    toolSummary: 'Built a unified customer account bundle for answer synthesis.',
    mcpServerName: 'customer-ops-hub',
    mcpCallCount: 3,
    mcpDuration: 460,
    mcpSummary: 'MCP gateway fanned out to profile, entitlement, and billing services.',
    customerProfileDuration: 85,
    customerProfileSummary: 'Customer tier is enterprise with premium routing enabled.',
    entitlementsDuration: 110,
    entitlementsOutcome: 'success',
    entitlementsSummary: 'Subscription pause is allowed from 2026-07-01 through 2026-07-31.',
    billingDuration: 96,
    billingOutcome: 'success',
    billingSummary: 'Outstanding balance is EUR 42.15 and the late fee can be waived.',
    answerInputTokens: 2120,
    answerOutputTokens: 620,
    answerCost: 0.047,
    answerDuration: 880,
    answerText:
      'Your annual support subscription can be paused for July without losing premium routing. You have an outstanding balance of EUR 42.15, and I have included the waiver instructions in the follow-up.',
    answerSummary: 'Delivered a grounded pause recommendation with routing and billing context.',
    evalScore: 0.96,
    evalLabel: 'excellent',
    evalOutcome: 'success',
    userRating: 'thumbs_up',
    feedbackComment: 'Solved the request in a single turn with the exact billing context I needed.',
    totalDuration: 2560,
  },
  {
    id: 'slow-entitlements-hop',
    promptText:
      'Can you pause the subscription next month, check the account routing policy, and tell me whether the balance is still blocking premium support?',
    rootOutcome: 'success',
    guardrailCategory: 'allow',
    guardrailOutcome: 'success',
    guardrailSummary: 'Prompt passed unchanged after routing-policy inspection.',
    guardrailAction: 'allow',
    plannerInputTokens: 560,
    plannerOutputTokens: 132,
    plannerCost: 0.012,
    plannerDuration: 390,
    plannerOutput: 'Need policy, entitlement pause window, and billing ledger to answer safely.',
    retrievalDuration: 170,
    retrievalDocuments: 6,
    retrievalQuality: 'grounded',
    retrievalSummary: 'Fetched six support-policy documents with one slow entitlement shard.',
    toolOutcome: 'success',
    toolName: 'lookup_customer_account_bundle',
    toolArguments: {
      customer_uuid: 'cust_001913',
      requested_action: 'pause_subscription',
      include_balance: true,
    },
    toolSummary: 'Collected the account bundle after waiting for a slow entitlement dependency.',
    mcpServerName: 'customer-ops-hub',
    mcpCallCount: 3,
    mcpDuration: 770,
    mcpSummary: 'MCP gateway waited on a slow entitlement lookup before merging results.',
    customerProfileDuration: 90,
    customerProfileSummary: 'Customer profile returned quickly with routing policy premium_plus.',
    entitlementsDuration: 420,
    entitlementsOutcome: 'success',
    entitlementsSummary: 'Entitlements responded slowly but confirmed the pause window.',
    billingDuration: 115,
    billingOutcome: 'success',
    billingSummary: 'Balance check completed with no overdue escalation flag.',
    answerInputTokens: 2240,
    answerOutputTokens: 640,
    answerCost: 0.051,
    answerDuration: 930,
    answerText:
      'The subscription can be paused next month and premium support remains active. The balance is still visible, but it is not blocking routing policy for the pause window.',
    answerSummary: 'Returned a correct answer after absorbing a slow entitlement dependency.',
    evalScore: 0.89,
    evalLabel: 'good',
    evalOutcome: 'success',
    userRating: 'thumbs_up',
    feedbackComment: 'The answer was correct, but the response felt slower than usual.',
    totalDuration: 3120,
    workflowWarning: 'Entitlement service latency exceeded the normal operating budget.',
  },
  {
    id: 'guardrail-rewritten',
    promptText:
      'Pause my account for July. My card ending in 4242 is on file and the last invoice should be waived if I still qualify for premium support.',
    rootOutcome: 'success',
    guardrailCategory: 'pii_rewrite',
    guardrailOutcome: 'success',
    guardrailSummary: 'Card details were redacted before the planner model received the prompt.',
    guardrailAction: 'rewrite',
    plannerInputTokens: 590,
    plannerOutputTokens: 128,
    plannerCost: 0.012,
    plannerDuration: 405,
    plannerOutput:
      'Proceed with a redacted account lookup and confirm balance plus premium routing eligibility.',
    retrievalDuration: 155,
    retrievalDocuments: 8,
    retrievalQuality: 'grounded',
    retrievalSummary: 'Fetched eight grounded documents after prompt rewriting.',
    toolOutcome: 'success',
    toolName: 'lookup_customer_account_bundle',
    toolArguments: {
      customer_uuid: 'cust_004242',
      requested_action: 'pause_subscription',
      include_balance: true,
      redacted_prompt: true,
    },
    toolSummary: 'Used the redacted prompt context to build a safe account bundle.',
    mcpServerName: 'customer-ops-hub',
    mcpCallCount: 3,
    mcpDuration: 500,
    mcpSummary: 'MCP gateway preserved the redacted context while fetching downstream data.',
    customerProfileDuration: 82,
    customerProfileSummary: 'Customer profile confirmed premium routing and no policy conflict.',
    entitlementsDuration: 118,
    entitlementsOutcome: 'success',
    entitlementsSummary: 'Entitlements confirmed the pause request is eligible.',
    billingDuration: 102,
    billingOutcome: 'success',
    billingSummary: 'Balance is EUR 18.00 and the waiver is permitted for this pause.',
    answerInputTokens: 2190,
    answerOutputTokens: 610,
    answerCost: 0.049,
    answerDuration: 910,
    answerText:
      'I removed the payment-card detail from the request before processing it. Your subscription can still be paused for July, premium routing remains active, and the EUR 18.00 balance qualifies for a waiver follow-up.',
    answerSummary:
      'Delivered a correct answer after rewriting the prompt to remove sensitive payment data.',
    evalScore: 0.92,
    evalLabel: 'safe_and_grounded',
    evalOutcome: 'success',
    userRating: 'thumbs_up',
    feedbackComment: 'The redaction was helpful and the answer still resolved the request.',
    totalDuration: 2680,
    workflowWarning: 'Guardrail rewrote the prompt before planning.',
  },
  {
    id: 'partial-context-regression',
    promptText:
      'Pause my support subscription next month, tell me if premium routing stays on, and explain the balance implications.',
    rootOutcome: 'failure',
    guardrailCategory: 'allow',
    guardrailOutcome: 'success',
    guardrailSummary: 'Prompt passed unchanged, but downstream data later became partial.',
    guardrailAction: 'warn',
    plannerInputTokens: 545,
    plannerOutputTokens: 118,
    plannerCost: 0.011,
    plannerDuration: 350,
    plannerOutput:
      'Need account bundle, but answer should degrade gracefully if billing is unavailable.',
    retrievalDuration: 148,
    retrievalDocuments: 5,
    retrievalQuality: 'stale_document',
    retrievalSummary: 'Retriever returned partially stale billing guidance.',
    toolOutcome: 'failure',
    toolName: 'lookup_customer_account_bundle',
    toolArguments: {
      customer_uuid: 'cust_009901',
      requested_action: 'pause_subscription',
      include_balance: true,
    },
    toolSummary: 'Tool completed with partial context after a billing dependency failure.',
    mcpServerName: 'customer-ops-hub',
    mcpCallCount: 3,
    mcpDuration: 620,
    mcpSummary:
      'MCP gateway returned profile and entitlement data but only partial billing context.',
    customerProfileDuration: 88,
    customerProfileSummary: 'Customer profile still confirmed premium routing eligibility.',
    entitlementsDuration: 125,
    entitlementsOutcome: 'success',
    entitlementsSummary: 'Entitlements confirmed the pause window without issue.',
    billingDuration: 160,
    billingOutcome: 'failure',
    billingSummary: 'Billing ledger timed out before returning the waiver state.',
    answerInputTokens: 1980,
    answerOutputTokens: 440,
    answerCost: 0.039,
    answerDuration: 860,
    answerText:
      'The subscription can be paused next month and premium routing should remain on, but I could not confirm the balance waiver because the billing ledger timed out. Please verify that portion manually.',
    answerSummary: 'Returned a partial answer because the billing ledger timed out.',
    evalScore: 0.58,
    evalLabel: 'partial_context',
    evalOutcome: 'failure',
    userRating: 'thumbs_down',
    feedbackComment: 'Routing was correct, but I still had to manually verify the billing part.',
    totalDuration: 2870,
    workflowWarning: 'Billing dependency timed out and produced a partial-context answer.',
  },
];

function deterministicTraceId(seed: string) {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32);
}

function buildTraceId(timestamp: Date | number, variantId: string, index: number) {
  return deterministicTraceId(
    `${STORY_ID}:${variantId}:${index}:${new Date(timestamp).toISOString()}`
  );
}

const scenario: Scenario<ApmOtelFields | LogDocument> = async ({ logger }) => {
  return {
    generate: ({ range, clients: { apmEsClient, logsEsClient } }) => {
      const namespace = `${ENVIRONMENT}.aipm.traces`;
      const createService = (name: string, sdkName: 'opentelemetry' | 'otlp' = 'opentelemetry') =>
        apm
          .otelService({
            name,
            namespace,
            sdkLanguage: 'nodejs',
            sdkName,
          })
          .instance(`${name}-instance`);

      const services = {
        orchestrator: createService('support-agent-gateway'),
        provider: createService('anthropic-router', 'otlp'),
        retriever: createService('customer-context-retriever'),
        toolRunner: createService('account-tool-runner'),
        mcpGateway: createService('customer-ops-mcp-gateway'),
        evaluator: createService('llm-judge-service'),
        guardrail: createService('prompt-guardrail-service'),
        customerProfile: createService('customer-profile-service'),
        entitlements: createService('entitlements-service'),
        billing: createService('billing-ledger-service'),
        feedback: createService('feedback-ingest-service'),
      };

      const traceEvents = range
        .interval('105s')
        .rate(8)
        .generator((timestamp, index) => {
          const variant = variants[index % variants.length];
          const ids = createStoryIdentifiers(STORY_ID, index, variant.id);
          const traceId = buildTraceId(timestamp, variant.id, index);
          const plannerStartedAt = timestamp + 130;
          const retrievalStartedAt = plannerStartedAt + variant.plannerDuration + 70;
          const toolStartedAt = retrievalStartedAt + variant.retrievalDuration + 80;
          const mcpStartedAt = toolStartedAt + 40;
          const customerProfileStartedAt = mcpStartedAt + 45;
          const entitlementsStartedAt = mcpStartedAt + 85;
          const billingStartedAt = mcpStartedAt + 125;
          const answerStartedAt = toolStartedAt + variant.mcpDuration + 150;
          const evaluationStartedAt = answerStartedAt + variant.answerDuration + 110;
          const feedbackStartedAt = evaluationStartedAt + 120;
          const totalCost = Number((variant.plannerCost + variant.answerCost).toFixed(3));
          const totalInputTokens = variant.plannerInputTokens + variant.answerInputTokens;
          const totalOutputTokens = variant.plannerOutputTokens + variant.answerOutputTokens;

          const guardrail = buildInternalSpan({
            instance: services.guardrail,
            name: 'guardrail.inspect_prompt',
            timestamp: timestamp + 20,
            duration: 90,
            outcome: variant.guardrailOutcome,
            extraFields: {
              'attributes.session.id': ids.sessionId,
              'attributes.es_sdk.story.id': STORY_ID,
              'attributes.es_sdk.workflow.id': ids.workflowId,
              'attributes.es_sdk.variant.id': variant.id,
              'attributes.es_integ.guardrail.category': variant.guardrailCategory,
              'attributes.es_sdk.guardrail.action': variant.guardrailAction,
              'attributes.es_sdk.map.step_id': 'guardrail.prompt',
              'attributes.es_sdk.map.parent_step_id': 'agent.orchestrator',
              'attributes.es_sdk.map.node_kind': 'guardrail',
              'attributes.es_sdk.map.label': 'Prompt guardrail',
              'attributes.es_sdk.map.response.summary': variant.guardrailSummary,
              ...(variant.workflowWarning
                ? { 'attributes.es_sdk.map.warning': variant.workflowWarning }
                : {}),
            },
          });

          const plannerModel = buildModelCallSpan({
            instance: services.provider,
            timestamp: plannerStartedAt,
            duration: variant.plannerDuration,
            outcome: 'success',
            provider: 'anthropic',
            model: 'claude-3-7-sonnet',
            identifiers: ids,
            inputTokens: variant.plannerInputTokens,
            outputTokens: variant.plannerOutputTokens,
            cost: variant.plannerCost,
            promptText: `Plan the minimal steps required to resolve this request safely: ${variant.promptText}`,
            outputText: variant.plannerOutput,
            extraFields: {
              'attributes.es_sdk.story.id': STORY_ID,
              'attributes.es_sdk.workflow.id': ids.workflowId,
              'attributes.es_sdk.variant.id': variant.id,
              'attributes.es_sdk.map.step_id': 'model.planner',
              'attributes.es_sdk.map.parent_step_id': 'guardrail.prompt',
              'attributes.es_sdk.map.node_kind': 'model',
              'attributes.es_sdk.map.label': 'Planner model',
              'attributes.es_sdk.map.phase': 'plan',
              'attributes.es_sdk.map.response.summary': variant.plannerOutput,
            },
          });

          const retrieval = buildInternalSpan({
            instance: services.retriever,
            name: 'retrieval.fetch_customer_context',
            timestamp: retrievalStartedAt,
            duration: variant.retrievalDuration,
            outcome: 'success',
            extraFields: {
              'attributes.session.id': ids.sessionId,
              'attributes.es_sdk.story.id': STORY_ID,
              'attributes.es_sdk.workflow.id': ids.workflowId,
              'attributes.es_sdk.variant.id': variant.id,
              'attributes.es_integ.retrieval.document_count': variant.retrievalDocuments,
              'attributes.es_integ.retrieval.result_quality': variant.retrievalQuality,
              'attributes.es_sdk.map.step_id': 'retrieval.context',
              'attributes.es_sdk.map.parent_step_id': 'model.planner',
              'attributes.es_sdk.map.node_kind': 'retriever',
              'attributes.es_sdk.map.label': 'Context retriever',
              'attributes.es_sdk.map.response.summary': variant.retrievalSummary,
            },
          });

          const customerProfileLookup = buildInternalSpan({
            instance: services.customerProfile,
            name: 'customer_profile.fetch_profile',
            timestamp: customerProfileStartedAt,
            duration: variant.customerProfileDuration,
            outcome: 'success',
            extraFields: {
              'attributes.session.id': ids.sessionId,
              'attributes.es_sdk.story.id': STORY_ID,
              'attributes.es_sdk.workflow.id': ids.workflowId,
              'attributes.es_sdk.variant.id': variant.id,
              'attributes.es_sdk.map.step_id': 'service.customer_profile',
              'attributes.es_sdk.map.parent_step_id': 'mcp.customer_ops_hub',
              'attributes.es_sdk.map.node_kind': 'service',
              'attributes.es_sdk.map.label': 'Customer profile service',
              'attributes.es_sdk.map.response.summary': variant.customerProfileSummary,
            },
          });

          const entitlementsLookup = buildInternalSpan({
            instance: services.entitlements,
            name: 'entitlements.fetch_pause_policy',
            timestamp: entitlementsStartedAt,
            duration: variant.entitlementsDuration,
            outcome: variant.entitlementsOutcome,
            extraFields: {
              'attributes.session.id': ids.sessionId,
              'attributes.es_sdk.story.id': STORY_ID,
              'attributes.es_sdk.workflow.id': ids.workflowId,
              'attributes.es_sdk.variant.id': variant.id,
              'attributes.es_sdk.map.step_id': 'service.entitlements',
              'attributes.es_sdk.map.parent_step_id': 'mcp.customer_ops_hub',
              'attributes.es_sdk.map.node_kind': 'service',
              'attributes.es_sdk.map.label': 'Entitlements service',
              'attributes.es_sdk.map.response.summary': variant.entitlementsSummary,
              ...(variant.entitlementsOutcome === 'failure'
                ? { 'attributes.es_sdk.map.warning': variant.entitlementsSummary }
                : {}),
            },
          });

          const billingLookup = buildInternalSpan({
            instance: services.billing,
            name: 'billing.fetch_account_balance',
            timestamp: billingStartedAt,
            duration: variant.billingDuration,
            outcome: variant.billingOutcome,
            extraFields: {
              'attributes.session.id': ids.sessionId,
              'attributes.es_sdk.story.id': STORY_ID,
              'attributes.es_sdk.workflow.id': ids.workflowId,
              'attributes.es_sdk.variant.id': variant.id,
              'attributes.es_sdk.map.step_id': 'service.billing',
              'attributes.es_sdk.map.parent_step_id': 'mcp.customer_ops_hub',
              'attributes.es_sdk.map.node_kind': 'service',
              'attributes.es_sdk.map.label': 'Billing ledger service',
              'attributes.es_sdk.map.response.summary': variant.billingSummary,
              ...(variant.billingOutcome === 'failure'
                ? { 'attributes.es_sdk.map.warning': variant.billingSummary }
                : {}),
            },
          });

          const mcpGateway = buildInternalSpan({
            instance: services.mcpGateway,
            name: 'mcp.invoke.customer_ops_hub',
            timestamp: mcpStartedAt,
            duration: variant.mcpDuration,
            outcome: variant.toolOutcome,
            extraFields: {
              'attributes.session.id': ids.sessionId,
              'attributes.es_sdk.story.id': STORY_ID,
              'attributes.es_sdk.workflow.id': ids.workflowId,
              'attributes.es_sdk.variant.id': variant.id,
              'attributes.es_integ.mcp.server_name': variant.mcpServerName,
              'attributes.es_integ.mcp.call_count': variant.mcpCallCount,
              'attributes.es_sdk.map.step_id': 'mcp.customer_ops_hub',
              'attributes.es_sdk.map.parent_step_id': 'tool.lookup_account_bundle',
              'attributes.es_sdk.map.node_kind': 'mcp',
              'attributes.es_sdk.map.label': `MCP server: ${variant.mcpServerName}`,
              'attributes.es_sdk.map.response.summary': variant.mcpSummary,
            },
          }).children(customerProfileLookup, entitlementsLookup, billingLookup);

          const toolSpan = buildToolSpan({
            instance: services.toolRunner,
            timestamp: toolStartedAt,
            duration: variant.mcpDuration + 140,
            outcome: variant.toolOutcome,
            toolName: variant.toolName,
            identifiers: ids,
            callId: nextToolCallId(STORY_ID, variant.id, index),
            argumentsJson: JSON.stringify(variant.toolArguments),
            extraFields: {
              'attributes.es_sdk.story.id': STORY_ID,
              'attributes.es_sdk.workflow.id': ids.workflowId,
              'attributes.es_sdk.variant.id': variant.id,
              'attributes.es_sdk.map.step_id': 'tool.lookup_account_bundle',
              'attributes.es_sdk.map.parent_step_id': 'retrieval.context',
              'attributes.es_sdk.map.node_kind': 'tool',
              'attributes.es_sdk.map.label': 'Tool: lookup_customer_account_bundle',
              'attributes.es_sdk.map.response.summary': variant.toolSummary,
              ...(variant.toolOutcome === 'failure'
                ? { 'attributes.es_sdk.map.warning': variant.toolSummary }
                : {}),
            },
          }).children(mcpGateway);

          const answerModel = buildModelCallSpan({
            instance: services.provider,
            timestamp: answerStartedAt,
            duration: variant.answerDuration,
            outcome: variant.rootOutcome,
            provider: 'anthropic',
            model: 'claude-3-7-sonnet',
            identifiers: ids,
            inputTokens: variant.answerInputTokens,
            outputTokens: variant.answerOutputTokens,
            cost: variant.answerCost,
            promptText: `Answer the user using only the grounded customer bundle: ${variant.promptText}`,
            outputText: variant.answerText,
            extraFields: {
              'attributes.es_sdk.story.id': STORY_ID,
              'attributes.es_sdk.workflow.id': ids.workflowId,
              'attributes.es_sdk.variant.id': variant.id,
              'attributes.es_sdk.map.step_id': 'model.answer',
              'attributes.es_sdk.map.parent_step_id': 'tool.lookup_account_bundle',
              'attributes.es_sdk.map.node_kind': 'model',
              'attributes.es_sdk.map.label': 'Answer model',
              'attributes.es_sdk.map.phase': 'answer',
              'attributes.es_sdk.map.response.summary': variant.answerSummary,
            },
          });

          const evaluation = buildEvaluationSpan({
            instance: services.evaluator,
            timestamp: evaluationStartedAt,
            duration: 120,
            outcome: variant.evalOutcome,
            score: variant.evalScore,
            label: variant.evalLabel,
            extraFields: {
              'attributes.es_sdk.story.id': STORY_ID,
              'attributes.es_sdk.workflow.id': ids.workflowId,
              'attributes.es_sdk.variant.id': variant.id,
              'attributes.es_sdk.eval.metric': 'resolution_groundedness',
              'attributes.es_sdk.map.step_id': 'eval.llm_judge',
              'attributes.es_sdk.map.parent_step_id': 'model.answer',
              'attributes.es_sdk.map.node_kind': 'evaluator',
              'attributes.es_sdk.map.label': 'LLM judge',
              'attributes.es_sdk.map.response.summary': `Score ${variant.evalScore.toFixed(2)} (${
                variant.evalLabel
              })`,
            },
          });

          const feedback = buildInternalSpan({
            instance: services.feedback,
            name: 'feedback.user_rating',
            timestamp: feedbackStartedAt,
            duration: 45,
            outcome: variant.userRating === 'thumbs_up' ? 'success' : 'failure',
            extraFields: {
              'attributes.session.id': ids.sessionId,
              'attributes.es_sdk.story.id': STORY_ID,
              'attributes.es_sdk.workflow.id': ids.workflowId,
              'attributes.es_sdk.variant.id': variant.id,
              'attributes.es_sdk.feedback.rating': variant.userRating,
              'attributes.es_sdk.feedback.comment': variant.feedbackComment,
              'attributes.es_sdk.map.step_id': 'feedback.user_rating',
              'attributes.es_sdk.map.parent_step_id': 'assistant.response',
              'attributes.es_sdk.map.node_kind': 'feedback',
              'attributes.es_sdk.map.label': 'User rating',
              'attributes.es_sdk.map.response.summary': variant.feedbackComment,
            },
          });

          const root = buildWorkflowRoot({
            instance: services.orchestrator,
            timestamp,
            duration: variant.totalDuration,
            outcome: variant.rootOutcome,
            workflowName: 'agent.resolve_subscription_pause',
            provider: 'anthropic',
            model: 'claude-3-7-sonnet',
            identifiers: ids,
            storyLabel: storyTraceLabel(STORY_ID, variant.id),
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            cost: totalCost,
            promptText: variant.promptText,
            outputText: variant.answerText,
            extraFields: {
              trace_id: traceId,
              'attributes.es_sdk.story.id': STORY_ID,
              'attributes.es_sdk.story.variant': variant.id,
              'attributes.es_sdk.variant.id': variant.id,
              'attributes.es_sdk.workflow.id': ids.workflowId,
              'attributes.es_sdk.feedback.rating': variant.userRating,
              'attributes.es_sdk.feedback.comment': variant.feedbackComment,
              'attributes.es_sdk.evaluation.score': variant.evalScore,
              'attributes.es_sdk.evaluation.label': variant.evalLabel,
              'attributes.es_sdk.total.cost': totalCost,
              'attributes.es_sdk.map.step_id': 'agent.orchestrator',
              'attributes.es_sdk.map.node_kind': 'agent',
              'attributes.es_sdk.map.label': 'Support resolution agent',
              'attributes.es_sdk.map.response.summary': variant.answerSummary,
              ...(variant.workflowWarning
                ? { 'attributes.es_sdk.map.warning': variant.workflowWarning }
                : {}),
            },
          }).children(
            guardrail,
            plannerModel,
            retrieval,
            toolSpan,
            answerModel,
            evaluation,
            feedback
          );

          return root;
        });

      const logEvents = range
        .interval('105s')
        .rate(8)
        .generator((timestamp, index) => {
          const variant = variants[index % variants.length];
          const ids = createStoryIdentifiers(STORY_ID, index, variant.id);
          const traceId = buildTraceId(timestamp, variant.id, index);

          return buildSessionLogs({
            timestamp,
            identifiers: ids,
            storyId: STORY_ID,
            serviceName: 'support-agent-gateway',
            sequenceStart: index * 20,
            traceId,
            messages: [
              {
                message: 'User prompt accepted for full-stack subscription workflow',
                action: 'prompt.accepted',
                extra: { variant_id: variant.id, user_rating: variant.userRating },
              },
              {
                message: variant.guardrailSummary,
                action: 'guardrail.completed',
                outcome: variant.guardrailOutcome,
                level: variant.guardrailAction === 'allow' ? 'info' : 'warn',
                extra: {
                  variant_id: variant.id,
                  guardrail_category: variant.guardrailCategory,
                  guardrail_action: variant.guardrailAction,
                },
              },
              {
                message: variant.toolSummary,
                action: 'tool.completed',
                outcome: variant.toolOutcome,
                level: variant.toolOutcome === 'success' ? 'info' : 'warn',
                extra: {
                  variant_id: variant.id,
                  tool_name: variant.toolName,
                  mcp_server_name: variant.mcpServerName,
                },
              },
              {
                message: variant.mcpSummary,
                action: 'mcp.completed',
                outcome: variant.toolOutcome,
                level: variant.toolOutcome === 'success' ? 'info' : 'warn',
                extra: {
                  variant_id: variant.id,
                  mcp_call_count: variant.mcpCallCount,
                  mcp_server_name: variant.mcpServerName,
                },
              },
              {
                message: variant.answerSummary,
                action: 'assistant.responded',
                outcome: variant.rootOutcome,
                level: variant.rootOutcome === 'success' ? 'info' : 'warn',
                extra: {
                  variant_id: variant.id,
                  answer_cost: variant.answerCost,
                  eval_score: variant.evalScore,
                },
              },
              {
                message: `LLM judge recorded ${variant.evalScore.toFixed(2)} (${
                  variant.evalLabel
                })`,
                action: 'evaluation.recorded',
                outcome: variant.evalOutcome,
                level: variant.evalOutcome === 'success' ? 'info' : 'warn',
                extra: {
                  variant_id: variant.id,
                  evaluation_score: variant.evalScore,
                  evaluation_label: variant.evalLabel,
                },
              },
              {
                message: `User feedback captured: ${variant.userRating}`,
                action: 'feedback.captured',
                outcome: variant.userRating === 'thumbs_up' ? 'success' : 'failure',
                level: variant.userRating === 'thumbs_up' ? 'info' : 'warn',
                extra: {
                  variant_id: variant.id,
                  feedback_rating: variant.userRating,
                  feedback_comment: variant.feedbackComment,
                },
              },
            ],
          });
        });

      return [
        withClient(
          apmEsClient,
          logger.perf('generate_aipm_fullstack_llm_journey_traces', () => traceEvents)
        ),
        withClient(
          logsEsClient,
          logger.perf('generate_aipm_fullstack_llm_journey_logs', () => logEvents)
        ),
      ];
    },
    setupPipeline: ({ apmEsClient }) =>
      apmEsClient.setPipeline(apmEsClient.resolvePipelineType(ApmSynthtracePipelineSchema.Otel)),
  };
};

export default scenario;
