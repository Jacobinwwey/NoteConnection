import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeLearningPlatform } from './KnowledgeLearningPlatform';
import {
    KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES,
    type KnowledgeWorkspaceConversationRegressionCase,
} from './KnowledgeWorkspaceConversationRegression';
import { createKnowledgeGraphStore } from './store';
import type { RagContextBudget, RagEvidenceRole, RagFailureStage, RagSourceDecision } from './types';

function deriveScopedConversationRequest(caseEntry: KnowledgeWorkspaceConversationRegressionCase) {
    const activeTarget = String(caseEntry.activeTarget || '').trim();
    return {
        userId: `regression_user_${caseEntry.id}`,
        sessionId: `regression_session_${caseEntry.id}`,
        message: caseEntry.query,
        persistMemory: false,
        topK: Number.isInteger(caseEntry.topK) && Number(caseEntry.topK) > 0
            ? Number(caseEntry.topK)
            : 8,
        scope: {
            workspaceId: activeTarget.toLowerCase(),
            corpusId: activeTarget.toLowerCase(),
            sourcePathPrefixes: [`Knowledge_Base/${activeTarget}`],
        },
    };
}

function buildContextBudgetProbeContent(): string {
    const longBudgetParagraph = [
        'Context budget probe evidence defines bounded context assembly as a RAG practice that reads the full source document for provenance and section routing, while only selected fragments enter the model-visible context pack.',
        'The source-reading boundary is intentionally wider than the answer prompt boundary, because source inspection may need headings, local paragraphs, terminal qualifiers, and graph-linked evidence before the pack budget chooses what the model can see.',
        'The context pack must record budget decisions such as fragment_included, fragment_truncated, and fragment_dropped so runtime probes can distinguish complete source access from unbounded prompt growth.',
        'A robust answer should use the direct hit, parent section context, and available graph-neighbor evidence, but it should not paste the entire source note into the user-facing response.',
    ].join(' ');
    return [
        '# Context Budget Probe',
        'Context budget probe is a runtime fixture for validating full-document source reading with a bounded model-visible RAG context pack.',
        '',
        '## Bounded Context Assembly',
        longBudgetParagraph.repeat(5),
        '',
        'Terminal qualifier: this fixture is scoped to budget verification and should not be treated as a general product explanation.',
    ].join('\n');
}

function buildOverflowBudgetProbeContent(): string {
    const sections = Array.from({ length: 18 }, (_entry, index) => {
        const segmentNumber = String(index + 1).padStart(2, '0');
        return [
            `## Overflow Budget Probe Segment ${segmentNumber}`,
            [
                `Overflow budget probe segment ${segmentNumber} records a distinct scoped evidence fragment for testing max-fragment pressure.`,
                'Overflow budget probe answers must remain deterministic when no LLM provider is configured.',
                'The RAG context pack should keep direct support first, then include only as much parent context as the budget allows.',
                `Segment ${segmentNumber} is intentionally concise so the probe stresses fragment count rather than per-fragment truncation.`,
            ].join(' '),
        ].join('\n');
    });
    return [
        '# Overflow Budget Probe',
        'Overflow budget probe validates deterministic no-provider RAG fallback under dense same-document evidence.',
        '',
        ...sections,
    ].join('\n\n');
}

function buildCausalAnswerProfileProbeContent(): string {
    return [
        '# Causal Answer Profile Probe',
        'Causal answer profile probe explains why graph-backed RAG answers need bounded causal evidence instead of a single definition sentence.',
        '',
        '## Mechanism',
        'The direct cause is that a why question asks for mechanism evidence, not only a label.',
        '',
        'The mechanism layer keeps the direct cause, the source boundary, and the downstream implication available before the bounded RAG pack chooses visible fragments.',
        '',
        '## Downstream Evidence',
        'The downstream implication is that graph-neighbor evidence can clarify consequences while the public answer still remains one bounded message.',
    ].join('\n');
}

function buildRegressionDocuments() {
    return [
        {
            documentId: 'doc_financial_liquidity',
            sourcePath: 'Knowledge_Base/financial/liquidity.md',
            language: 'en',
            workspaceId: 'financial',
            corpusId: 'financial',
            content: '# Liquidity\nLiquidity analysis explains cash conversion and working capital timing.',
        },
        {
            documentId: 'doc_financial_glass_steagall',
            sourcePath: 'Knowledge_Base/financial/glass steagall act.md',
            language: 'en',
            workspaceId: 'financial',
            corpusId: 'financial',
            content: '# Glass-Steagall Act\nThe Glass-Steagall Act separated commercial and investment banking activities.',
        },
        {
            documentId: 'doc_financial_watered_stock',
            sourcePath: 'Knowledge_Base/financial/watered stock.md',
            language: 'en',
            workspaceId: 'financial',
            corpusId: 'financial',
            content: '# Watered Stock\nWatered stock refers to shares issued at a value greater than the assets that back them.',
        },
        {
            documentId: 'doc_water_glass_runtime',
            sourcePath: 'Knowledge_Base/waterglass/water glass.md',
            language: 'zh',
            workspaceId: 'waterglass',
            corpusId: 'waterglass',
            content: [
                '# 水杯 (water glass)',
                '水杯 (water glass) 是一个用于盛水的透明容器。',
                '',
                '## Material role',
                'The water glass body provides a boundary between the liquid and the environment.',
                '',
                '## Container material comparison',
                'A water glass uses soda-lime glass, so it is transparent, stiff, brittle, and chemically inert.',
                'A plastic cup uses PET plastic, so it is lightweight, ductile, less stiff, and more insulating.',
                'Compared with a plastic cup, a water glass gives better optical transparency and rigidity, while the plastic cup reduces fracture risk.',
            ].join('\n'),
        },
        {
            documentId: 'doc_conflicting_adjacent_evidence_probe',
            sourcePath: 'Knowledge_Base/ragconflict/calibration tolerance conflict probe.md',
            language: 'en',
            workspaceId: 'ragconflict',
            corpusId: 'ragconflict',
            content: [
                '# The Calibration Tolerance Conflict Probe',
                'Calibration tolerance conflict probe validates that adjacent contradictory source facts are not flattened into a stable value.',
                '',
                '## Tolerance Statements',
                'The calibration tolerance is +/-0.10 mm in the nominal bench procedure.',
                'The calibration tolerance is +/-0.50 mm in the field override note.',
                'Operators must resolve the active procedure before publishing a tolerance value.',
            ].join('\n'),
        },
        {
            documentId: 'doc_conflicting_nonadjacent_evidence_probe',
            sourcePath: 'Knowledge_Base/ragconflict/remote calibration tolerance conflict probe.md',
            language: 'en',
            workspaceId: 'ragconflict',
            corpusId: 'ragconflict',
            content: [
                '# Remote Calibration Tolerance Conflict Probe',
                'Remote calibration tolerance conflict probe validates that non-adjacent contradictory source facts inside one section are not flattened into a stable value.',
                '',
                '## Tolerance Statements',
                'The calibration tolerance is +/-0.10 mm in the nominal bench procedure.',
                '',
                'Context paragraph one keeps the source section long enough to exceed the local window.',
                '',
                'Context paragraph two keeps the source section long enough to exceed the local window.',
                '',
                'Context paragraph three keeps the source section long enough to exceed the local window.',
                '',
                'Context paragraph four keeps the source section long enough to exceed the local window.',
                '',
                'Context paragraph five keeps the source section long enough to exceed the local window.',
                '',
                'Context paragraph six keeps the source section long enough to exceed the local window.',
                '',
                'Context paragraph seven keeps the source section long enough to exceed the local window.',
                '',
                'The calibration tolerance is +/-0.50 mm in the field override note.',
                'Operators must resolve the active procedure before publishing a tolerance value.',
            ].join('\n'),
        },
        {
            documentId: 'doc_conflicting_release_date_probe',
            sourcePath: 'Knowledge_Base/ragdateconflict/release date conflict probe.md',
            language: 'en',
            workspaceId: 'ragdateconflict',
            corpusId: 'ragdateconflict',
            content: [
                '# Release Date Conflict Probe',
                'Release date conflict probe validates that date contradictions inside one section are not flattened into a stable schedule.',
                '',
                '## Release Schedule',
                'The migration release date is 2026-07-01.',
                '',
                'Context paragraph one keeps the release schedule section beyond the local window.',
                '',
                'Context paragraph two keeps the release schedule section beyond the local window.',
                '',
                'Context paragraph three keeps the release schedule section beyond the local window.',
                '',
                'Context paragraph four keeps the release schedule section beyond the local window.',
                '',
                'Context paragraph five keeps the release schedule section beyond the local window.',
                '',
                'Context paragraph six keeps the release schedule section beyond the local window.',
                '',
                'The migration release date is 2026-08-15.',
                'Operators must resolve the active release record before publishing the schedule.',
            ].join('\n'),
        },
        {
            documentId: 'doc_conflicting_state_status_probe',
            sourcePath: 'Knowledge_Base/ragstateconflict/state status conflict probe.md',
            language: 'en',
            workspaceId: 'ragstateconflict',
            corpusId: 'ragstateconflict',
            content: [
                '# State Status Conflict Probe',
                'State status conflict probe validates that categorical state contradictions are not flattened into one stable status.',
                '',
                '## Gate Status',
                'The migration gate status is enabled in the release checklist.',
                '',
                'Context paragraph keeps the categorical state conflict inside one scoped section.',
                '',
                'The migration gate status is disabled in the rollback appendix.',
                'Operators must resolve which status record is active before release.',
            ].join('\n'),
        },
        {
            documentId: 'doc_conflicting_quantity_limit_probe',
            sourcePath: 'Knowledge_Base/ragquantityconflict/quantity limit conflict probe.md',
            language: 'en',
            workspaceId: 'ragquantityconflict',
            corpusId: 'ragquantityconflict',
            content: [
                '# Quantity Limit Conflict Probe',
                'Quantity limit conflict probe validates that unitless operational limits are not flattened into one stable value.',
                '',
                '## Retry Limit',
                'The retry limit is 3 in the release checklist.',
                '',
                'Context paragraph keeps the retry limit conflict inside one scoped section.',
                '',
                'The retry limit is 5 in the rollback appendix.',
                'Operators must resolve which retry limit is active before release.',
            ].join('\n'),
        },
        {
            documentId: 'doc_conflicting_ownership_identity_probe',
            sourcePath: 'Knowledge_Base/ragidentityconflict/ownership conflict probe.md',
            language: 'en',
            workspaceId: 'ragidentityconflict',
            corpusId: 'ragidentityconflict',
            content: [
                '# Ownership Conflict Probe',
                'Ownership conflict probe validates that controlled responsibility records are not flattened into one stable owner.',
                '',
                '## Deployment Ownership',
                'The deployment owner is Release Ops in the handoff sheet.',
                '',
                'Context paragraph keeps the ownership conflict inside one scoped section.',
                '',
                'The deployment owner is Rollback Team in the rollback appendix.',
                'Operators must resolve which deployment owner is active before release.',
            ].join('\n'),
        },
        {
            documentId: 'doc_handoff_deployment_owner_conflict_probe',
            sourcePath: 'Knowledge_Base/ragidentitymulticonflict/handoff deployment owner conflict probe.md',
            language: 'en',
            workspaceId: 'ragidentitymulticonflict',
            corpusId: 'ragidentitymulticonflict',
            content: [
                '# Handoff Deployment Owner Conflict Probe',
                'Handoff deployment owner conflict probe provides the handoff-side owner record.',
                '',
                '## Handoff Owner Source',
                'The deployment owner is Release Ops in the handoff owner record.',
                'Operators must compare this owner source against rollback evidence before publishing a deployment owner.',
            ].join('\n'),
        },
        {
            documentId: 'doc_rollback_deployment_owner_conflict_evidence',
            sourcePath: 'Knowledge_Base/ragidentitymulticonflict/rollback deployment owner conflict evidence.md',
            language: 'en',
            workspaceId: 'ragidentitymulticonflict',
            corpusId: 'ragidentitymulticonflict',
            content: [
                '# Rollback Deployment Owner Conflict Evidence',
                'Rollback deployment owner conflict evidence provides the rollback-side owner record.',
                '',
                '## Rollback Owner Source',
                'The deployment owner is Rollback Team in the rollback owner record.',
                'Operators must resolve the active owner source before publishing a stable deployment owner.',
            ].join('\n'),
        },
        {
            documentId: 'doc_conflicting_location_probe',
            sourcePath: 'Knowledge_Base/raglocationconflict/location conflict probe.md',
            language: 'en',
            workspaceId: 'raglocationconflict',
            corpusId: 'raglocationconflict',
            content: [
                '# Control Module Location Conflict Probe',
                'Control module location conflict probe validates that controlled location contradictions are not flattened into one stable site.',
                '',
                '## Module Placement',
                'The control module location is Rack A in the primary bay.',
                '',
                'Context paragraph keeps the controlled location conflict inside one scoped section.',
                '',
                'The control module location is Rack B in the field bay.',
                'Operators must resolve the active placement record before publishing location guidance.',
            ].join('\n'),
        },
        {
            documentId: 'doc_temporal_state_status_probe',
            sourcePath: 'Knowledge_Base/ragtemporalqualifier/temporal state status probe.md',
            language: 'en',
            workspaceId: 'ragtemporalqualifier',
            corpusId: 'ragtemporalqualifier',
            content: [
                '# Temporal State Status Probe',
                'Temporal state status probe validates that the migration gate status is enabled in the current release record while historical status facts remain condition-qualified evidence rather than a conflict.',
                '',
                '## Gate Status History',
                'The migration gate status is enabled in the current release record.',
                '',
                'Operators should answer with the active record while retaining the older record as provenance.',
                '',
                'The migration gate status is disabled in the historical rollback archive.',
            ].join('\n'),
        },
        {
            documentId: 'doc_temporal_deployment_owner_probe',
            sourcePath: 'Knowledge_Base/ragtemporalqualifier/temporal deployment owner probe.md',
            language: 'en',
            workspaceId: 'ragtemporalqualifier',
            corpusId: 'ragtemporalqualifier',
            content: [
                '# Temporal Deployment Owner Probe',
                'Temporal deployment owner probe validates that the deployment owner is Release Ops in the current release record while historical owner facts remain condition-qualified evidence rather than a conflict.',
                '',
                '## Deployment Owner History',
                'The deployment owner is Release Ops in the current release record.',
                '',
                'Operators should answer with the active owner while retaining the older owner as provenance.',
                '',
                'The deployment owner is Rollback Team in the historical rollback archive.',
            ].join('\n'),
        },
        {
            documentId: 'doc_environment_scoped_state_status_probe',
            sourcePath: 'Knowledge_Base/ragenvironmentqualifier/environment scoped state status probe.md',
            language: 'en',
            workspaceId: 'ragenvironmentqualifier',
            corpusId: 'ragenvironmentqualifier',
            content: [
                '# Environment Scoped State Status Probe',
                'Environment scoped state status probe validates that the migration gate status is enabled in the staging environment while production status facts remain environment-qualified evidence rather than a conflict.',
                '',
                '## Gate Status By Environment',
                'The migration gate status is enabled in the staging environment.',
                '',
                'Operators should preserve the environment label when comparing deployment records.',
                '',
                'The migration gate status is disabled in the production environment.',
            ].join('\n'),
        },
        {
            documentId: 'doc_environment_scoped_deployment_owner_probe',
            sourcePath: 'Knowledge_Base/ragenvironmentqualifier/environment scoped deployment owner probe.md',
            language: 'en',
            workspaceId: 'ragenvironmentqualifier',
            corpusId: 'ragenvironmentqualifier',
            content: [
                '# Environment Scoped Deployment Owner Probe',
                'Environment scoped deployment owner probe validates that the deployment owner is Release Ops in the staging environment while production owner facts remain environment-qualified evidence rather than a conflict.',
                '',
                '## Deployment Owner By Environment',
                'The deployment owner is Release Ops in the staging environment.',
                '',
                'Operators should preserve the environment label before comparing owner records.',
                '',
                'The deployment owner is Rollback Team in the production environment.',
            ].join('\n'),
        },
        {
            documentId: 'doc_version_scoped_state_status_probe',
            sourcePath: 'Knowledge_Base/ragversionqualifier/version scoped state status probe.md',
            language: 'en',
            workspaceId: 'ragversionqualifier',
            corpusId: 'ragversionqualifier',
            content: [
                '# Version Scoped State Status Probe',
                'Version scoped state status probe validates that the migration gate status is enabled in version 1.0 while version 2.0 status facts remain version-qualified evidence rather than a conflict.',
                '',
                '## Gate Status By Version',
                'The migration gate status is enabled in version 1.0.',
                '',
                'Operators should preserve the version label when comparing release records.',
                '',
                'The migration gate status is disabled in version 2.0.',
            ].join('\n'),
        },
        {
            documentId: 'doc_version_scoped_deployment_owner_probe',
            sourcePath: 'Knowledge_Base/ragversionqualifier/version scoped deployment owner probe.md',
            language: 'en',
            workspaceId: 'ragversionqualifier',
            corpusId: 'ragversionqualifier',
            content: [
                '# Version Scoped Deployment Owner Probe',
                'Version scoped deployment owner probe validates that the deployment owner is Release Ops in version 1.0 while version 2.0 owner facts remain version-qualified evidence rather than a conflict.',
                '',
                '## Deployment Owner By Version',
                'The deployment owner is Release Ops in version 1.0.',
                '',
                'Operators should preserve the version label before comparing owner records.',
                '',
                'The deployment owner is Rollback Team in version 2.0.',
            ].join('\n'),
        },
        {
            documentId: 'doc_platform_scoped_state_status_probe',
            sourcePath: 'Knowledge_Base/ragplatformqualifier/platform scoped state status probe.md',
            language: 'en',
            workspaceId: 'ragplatformqualifier',
            corpusId: 'ragplatformqualifier',
            content: [
                '# Platform Scoped State Status Probe',
                'Platform scoped state status probe validates that the migration gate status is enabled on the Windows platform while Android status facts remain platform-qualified evidence rather than a conflict.',
                '',
                '## Gate Status By Platform',
                'The migration gate status is enabled on the Windows platform.',
                '',
                'Operators should preserve the platform label when comparing runtime records.',
                '',
                'The migration gate status is disabled on the Android platform.',
            ].join('\n'),
        },
        {
            documentId: 'doc_platform_scoped_deployment_owner_probe',
            sourcePath: 'Knowledge_Base/ragplatformqualifier/platform scoped deployment owner probe.md',
            language: 'en',
            workspaceId: 'ragplatformqualifier',
            corpusId: 'ragplatformqualifier',
            content: [
                '# Platform Scoped Deployment Owner Probe',
                'Platform scoped deployment owner probe validates that the deployment owner is Release Ops on the Windows platform while Android owner facts remain platform-qualified evidence rather than a conflict.',
                '',
                '## Deployment Owner By Platform',
                'The deployment owner is Release Ops on the Windows platform.',
                '',
                'Operators should preserve the platform label before comparing owner records.',
                '',
                'The deployment owner is Rollback Team on the Android platform.',
            ].join('\n'),
        },
        {
            documentId: 'doc_temporal_location_probe',
            sourcePath: 'Knowledge_Base/ragtemporalqualifier/temporal location probe.md',
            language: 'en',
            workspaceId: 'ragtemporalqualifier',
            corpusId: 'ragtemporalqualifier',
            content: [
                '# Temporal Module Placement Probe',
                'Temporal module placement probe validates that the control module location is Rack A in the current release record while historical placement facts remain condition-qualified evidence rather than a conflict.',
                '',
                '## Module Placement History',
                'The control module location is Rack A in the current release record.',
                '',
                'Operators should answer with the active placement while retaining the older placement as provenance.',
                '',
                'The control module location is Rack B in the historical placement archive.',
            ].join('\n'),
        },
        {
            documentId: 'doc_temporal_release_date_probe',
            sourcePath: 'Knowledge_Base/ragtemporalqualifier/temporal release date probe.md',
            language: 'en',
            workspaceId: 'ragtemporalqualifier',
            corpusId: 'ragtemporalqualifier',
            content: [
                '# Temporal Release Date Probe',
                'Temporal release date probe validates that the migration release date is 2026-08-15 in the current release record while historical dates remain condition-qualified evidence rather than a conflict.',
                '',
                '## Release Date History',
                'The migration release date is 2026-08-15 in the current release record.',
                '',
                'Operators should answer with the current schedule while retaining the older schedule as provenance.',
                '',
                'The migration release date is 2026-07-01 in the historical rollout archive.',
            ].join('\n'),
        },
        {
            documentId: 'doc_temporal_planned_release_date_probe',
            sourcePath: 'Knowledge_Base/ragtemporalqualifier/temporal planned release date probe.md',
            language: 'en',
            workspaceId: 'ragtemporalqualifier',
            corpusId: 'ragtemporalqualifier',
            content: [
                '# Temporal Planned Release Date Probe',
                'Temporal planned release date probe validates that the migration release date is 2026-08-15 in the current release record while planned roadmap dates remain future-qualified evidence rather than a conflict.',
                '',
                '## Release Date Roadmap',
                'The migration release date is 2026-08-15 in the current release record.',
                '',
                'Operators should answer with the current schedule while retaining planned roadmap material as future-qualified evidence.',
                '',
                'The migration release date is 2026-09-20 in the planned rollout draft.',
            ].join('\n'),
        },
        {
            documentId: 'doc_temporal_current_release_source',
            sourcePath: 'Knowledge_Base/ragtemporalcrossscope/temporal current release source.md',
            language: 'en',
            workspaceId: 'ragtemporalcrossscope',
            corpusId: 'ragtemporalcrossscope',
            content: [
                '# Temporal Current Release Source',
                'Temporal current release source records that the migration release date is 2026-08-15 in the current release record.',
                '',
                '## Current Schedule',
                'The migration release date is 2026-08-15 in the current release record.',
            ].join('\n'),
        },
        {
            documentId: 'doc_temporal_planned_roadmap_source',
            sourcePath: 'Knowledge_Base/ragtemporalcrossscope/temporal planned roadmap source.md',
            language: 'en',
            workspaceId: 'ragtemporalcrossscope',
            corpusId: 'ragtemporalcrossscope',
            content: [
                '# Temporal Planned Roadmap Source',
                'Temporal planned roadmap source records that the migration release date is 2026-09-20 in the planned rollout draft.',
                '',
                '## Planned Roadmap',
                'The migration release date is 2026-09-20 in the planned rollout draft.',
            ].join('\n'),
        },
        {
            documentId: 'doc_multi_document_calibration_tolerance_conflict_probe',
            sourcePath: 'Knowledge_Base/ragmulticonflict/multi document calibration tolerance conflict probe.md',
            language: 'en',
            workspaceId: 'ragmulticonflict',
            corpusId: 'ragmulticonflict',
            content: [
                '# Multi Document Calibration Tolerance Conflict Probe',
                'Multi document calibration tolerance conflict probe validates that contradictory scoped facts across documents are not flattened into one stable value.',
                '',
                '## Nominal Source',
                'The calibration tolerance is +/-0.10 mm in the nominal record.',
                'Operators must compare this source against field evidence before publishing a tolerance value.',
            ].join('\n'),
        },
        {
            documentId: 'doc_field_calibration_tolerance_conflict_evidence',
            sourcePath: 'Knowledge_Base/ragmulticonflict/field calibration tolerance conflict evidence.md',
            language: 'en',
            workspaceId: 'ragmulticonflict',
            corpusId: 'ragmulticonflict',
            content: [
                '# Field Calibration Tolerance Conflict Evidence',
                'Multi document calibration tolerance conflict probe field evidence records the field-side tolerance statement.',
                '',
                '## Field Source',
                'The calibration tolerance is +/-0.50 mm in the field record.',
                'Operators must resolve the active source before publishing a stable calibration tolerance.',
            ].join('\n'),
        },
        {
            documentId: 'doc_nominal_retry_attempts_quantity_conflict_probe',
            sourcePath: 'Knowledge_Base/ragquantitymulticonflict/nominal retry attempts quantity conflict probe.md',
            language: 'en',
            workspaceId: 'ragquantitymulticonflict',
            corpusId: 'ragquantitymulticonflict',
            content: [
                '# Nominal Retry Attempts Quantity Conflict Probe',
                'Nominal retry attempts quantity conflict probe validates that plural unitless quantity facts across documents are not flattened into one stable count.',
                '',
                '## Nominal Retry Source',
                'The retry attempts are 3 in the nominal retry record.',
                'Operators must compare this source against field evidence before publishing a retry-attempt count.',
            ].join('\n'),
        },
        {
            documentId: 'doc_field_retry_attempts_quantity_conflict_evidence',
            sourcePath: 'Knowledge_Base/ragquantitymulticonflict/field retry attempts quantity conflict evidence.md',
            language: 'en',
            workspaceId: 'ragquantitymulticonflict',
            corpusId: 'ragquantitymulticonflict',
            content: [
                '# Field Retry Attempts Quantity Conflict Evidence',
                'Field retry attempts quantity conflict evidence records the field-side plural retry quantity.',
                '',
                '## Field Retry Source',
                'The retry attempts are 5 in the field retry record.',
                'Operators must resolve the active retry source before publishing a stable retry-attempt count.',
            ].join('\n'),
        },
        {
            documentId: 'doc_nominal_full_scan_source',
            sourcePath: 'Knowledge_Base/ragfullscan/nominal full scan source.md',
            language: 'en',
            workspaceId: 'ragfullscan',
            corpusId: 'ragfullscan',
            content: [
                '# Nominal Full Scan Source',
                'Nominal full scan source is the scoped document anchor for full-document augmentation.',
                '',
                'This opening section is intentionally separate from the remote tolerance statement.',
                '',
                'Local filler paragraph one keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph two keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph three keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph four keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph five keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph six keeps the remote appendix away from the matched opening span.',
                '',
                '## Remote Nominal Appendix',
                'The calibration tolerance is +/-0.10 mm in the remote nominal appendix.',
            ].join('\n'),
        },
        {
            documentId: 'doc_field_full_scan_source',
            sourcePath: 'Knowledge_Base/ragfullscan/field full scan source.md',
            language: 'en',
            workspaceId: 'ragfullscan',
            corpusId: 'ragfullscan',
            content: [
                '# Field Full Scan Source',
                'Field full scan source is the scoped comparison document for full-document augmentation.',
                '',
                'This opening section is intentionally separate from the remote tolerance statement.',
                '',
                'Local filler paragraph one keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph two keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph three keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph four keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph five keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph six keeps the remote appendix away from the matched opening span.',
                '',
                '## Remote Field Appendix',
                'The calibration tolerance is +/-0.50 mm in the remote field appendix.',
            ].join('\n'),
        },
        {
            documentId: 'doc_repeated_snippet_target_probe',
            sourcePath: 'Knowledge_Base/ragrepeatedspan/repeated snippet target section.md',
            language: 'en',
            workspaceId: 'ragrepeatedspan',
            corpusId: 'ragrepeatedspan',
            content: [
                '# Repeated Snippet Target Section',
                'Repeated snippet target probe validates source anchoring when the same clause appears in multiple sections.',
                '',
                '## Repeated Snippet Distractor Section',
                'The repeated snippet uses shared repeated wording.',
                'Distractor section context belongs to the first occurrence and must not guide the target answer.',
                '',
                '## Repeated Snippet Target Section',
                'The repeated snippet uses shared repeated wording.',
                'Target section context says the second occurrence controls the answer.',
            ].join('\n'),
        },
        {
            documentId: 'doc_graphintent_brittle_glass_vessel',
            sourcePath: 'Knowledge_Base/graphintent/brittle glass vessel.md',
            language: 'en',
            workspaceId: 'graphintent',
            corpusId: 'graphintent',
            content: [
                '# Brittle Glass Vessel',
                'Brittle glass vessel water container material wall stiffness clarity fracture comparison impact tolerance.',
            ].join('\n'),
        },
        {
            documentId: 'doc_graphintent_procedural_calibration_sequence',
            sourcePath: 'Knowledge_Base/graphintent/procedural calibration sequence.md',
            language: 'en',
            workspaceId: 'graphintent',
            corpusId: 'graphintent',
            content: [
                '# Procedural Calibration Sequence',
                'Procedural calibration sequence brittle glass vessel water container material wall stiffness clarity fracture comparison impact tolerance rinse align fill record.',
            ].join('\n'),
        },
        {
            documentId: 'doc_graphintent_ductile_polymer_cup',
            sourcePath: 'Knowledge_Base/graphintent/ductile polymer cup analogy.md',
            language: 'en',
            workspaceId: 'graphintent',
            corpusId: 'graphintent',
            content: [
                '# Ductile Polymer Cup Analogy',
                'Ductile polymer cup water container material wall comparison impact tolerance flexible fracture resistance.',
            ].join('\n'),
        },
        {
            documentId: 'doc_graphintent_reusable_polymer_vessel',
            sourcePath: 'Knowledge_Base/graphintent/reusable polymer vessel analogy.md',
            language: 'en',
            workspaceId: 'graphintent',
            corpusId: 'graphintent',
            content: [
                '# Reusable Polymer Vessel Analogy',
                'Reusable polymer vessel water container material wall comparison impact tolerance flexible ductility stiffness tradeoff.',
            ].join('\n'),
        },
        {
            documentId: 'doc_context_budget_probe',
            sourcePath: 'Knowledge_Base/contextbudget/context budget probe.md',
            language: 'en',
            workspaceId: 'contextbudget',
            corpusId: 'contextbudget',
            content: buildContextBudgetProbeContent(),
        },
        {
            documentId: 'doc_overflow_budget_probe',
            sourcePath: 'Knowledge_Base/contextoverflow/overflow budget probe.md',
            language: 'en',
            workspaceId: 'contextoverflow',
            corpusId: 'contextoverflow',
            content: buildOverflowBudgetProbeContent(),
        },
        {
            documentId: 'doc_causal_answer_profile_probe',
            sourcePath: 'Knowledge_Base/ragcausalprofile/causal answer profile probe.md',
            language: 'en',
            workspaceId: 'ragcausalprofile',
            corpusId: 'ragcausalprofile',
            content: buildCausalAnswerProfileProbeContent(),
        },
    ];
}

function countRagSourceDecisionStatuses(
    decisions: RagSourceDecision[] | undefined
): Record<string, number> {
    return (Array.isArray(decisions) ? decisions : []).reduce<Record<string, number>>((counts, decision) => {
        const status = String(decision?.status || '').trim();
        if (!status) {
            return counts;
        }
        counts[status] = (counts[status] || 0) + 1;
        return counts;
    }, {});
}

function expectRagBudget(
    actual: RagContextBudget | undefined,
    expected: Partial<RagContextBudget> | undefined
): void {
    if (!expected) {
        return;
    }
    expect(actual).toBeDefined();
    if (typeof expected.maxFragments === 'number') {
        expect(actual?.maxFragments).toBe(expected.maxFragments);
    }
    if (typeof expected.maxCharsPerFragment === 'number') {
        expect(actual?.maxCharsPerFragment).toBe(expected.maxCharsPerFragment);
    }
    if (typeof expected.maxTotalChars === 'number') {
        expect(actual?.maxTotalChars).toBe(expected.maxTotalChars);
    }
}

function countFullDocumentRagFragmentsByRole(
    response: Awaited<ReturnType<KnowledgeLearningPlatform['agentConversation']>>
): Partial<Record<RagEvidenceRole, number>> {
    return (response.trace.ragContextPack?.fragments || []).reduce<Partial<Record<RagEvidenceRole, number>>>(
        (counts, fragment) => {
            if (fragment.sourceBoundary !== 'full_document') {
                return counts;
            }
            counts[fragment.role] = (counts[fragment.role] || 0) + 1;
            return counts;
        },
        {}
    );
}

function collectRagFailureStages(
    response: Awaited<ReturnType<KnowledgeLearningPlatform['agentConversation']>>
): RagFailureStage[] {
    return (response.trace.ragFailureClassifications || [])
        .map((classification) => classification.stage)
        .filter((stage): stage is RagFailureStage => Boolean(stage));
}

function expectReasonFragments(
    observedReasons: readonly string[] | undefined,
    requiredFragments: readonly string[] | undefined
): void {
    if (!requiredFragments || requiredFragments.length <= 0) {
        return;
    }
    const reasons = Array.isArray(observedReasons)
        ? observedReasons.map((reason) => String(reason || ''))
        : [];
    requiredFragments.forEach((fragment) => {
        expect(reasons.some((reason) => reason.includes(fragment))).toBe(true);
    });
}

function graphSuccessorWindow(response: Awaited<ReturnType<KnowledgeLearningPlatform['agentConversation']>>) {
    const graphContext = response.trace.graphContext as any;
    return Array.isArray(graphContext?.successorWindow) ? graphContext.successorWindow : [];
}

function graphSuccessorTitles(response: Awaited<ReturnType<KnowledgeLearningPlatform['agentConversation']>>): string[] {
    return graphSuccessorWindow(response)
        .map((node: any) => String(node?.title || '').trim())
        .filter(Boolean);
}

function graphSuccessorRelationKinds(response: Awaited<ReturnType<KnowledgeLearningPlatform['agentConversation']>>): string[] {
    return graphSuccessorWindow(response)
        .map((node: any) => String(node?.relationKind || '').trim())
        .filter(Boolean);
}

function graphNeighborFragmentTitles(response: Awaited<ReturnType<KnowledgeLearningPlatform['agentConversation']>>): string[] {
    return (response.trace.ragContextPack?.fragments || [])
        .filter((fragment) => fragment.role === 'graph_neighbor_support')
        .map((fragment) => String(fragment.title || '').trim())
        .filter(Boolean);
}

function graphDiagnostics(response: Awaited<ReturnType<KnowledgeLearningPlatform['agentConversation']>>) {
    const graphContext = response.trace.graphContext as any;
    return graphContext?.diagnostics && typeof graphContext.diagnostics === 'object'
        ? graphContext.diagnostics
        : {};
}

function caseNeedsGraphOpsStore(caseEntry: KnowledgeWorkspaceConversationRegressionCase): boolean {
    const expected = caseEntry.expected;
    return Boolean(
        expected.requiredFirstGraphSuccessorTitle
        || (expected.requiredGraphSuccessorTitles && expected.requiredGraphSuccessorTitles.length > 0)
        || (expected.forbiddenGraphSuccessorTitles && expected.forbiddenGraphSuccessorTitles.length > 0)
        || (expected.requiredGraphSuccessorRelationKinds && expected.requiredGraphSuccessorRelationKinds.length > 0)
        || typeof expected.minimumGraphIntentAlignedPredecessorCandidates === 'number'
        || typeof expected.minimumGraphIntentAlignedSuccessorCandidates === 'number'
        || typeof expected.minimumGraphIntentMisalignedPredecessorCandidates === 'number'
        || typeof expected.minimumGraphIntentMisalignedSuccessorCandidates === 'number'
        || typeof expected.expectedGraphUsedMisalignedPredecessorFallback === 'boolean'
        || typeof expected.expectedGraphUsedMisalignedSuccessorFallback === 'boolean'
    );
}

function createRegressionPlatform(caseEntry: KnowledgeWorkspaceConversationRegressionCase): {
    platform: KnowledgeLearningPlatform;
    cleanup: () => void;
} {
    if (!caseNeedsGraphOpsStore(caseEntry)) {
        return {
            platform: new KnowledgeLearningPlatform(() => new Date('2026-06-18T00:00:00.000Z')),
            cleanup: () => {},
        };
    }
    const tempDir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-knowledge-conversation-regression-'));
    const store = createKnowledgeGraphStore({
        backend: 'file',
        filePath: path.join(tempDir, 'knowledge_graph.snapshot.json'),
    });
    return {
        platform: new KnowledgeLearningPlatform({
            nowProvider: () => new Date('2026-06-18T00:00:00.000Z'),
            store,
            autoPersist: true,
        }),
        cleanup: () => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        },
    };
}

describe('KnowledgeWorkspaceConversationRegression', () => {
    test('case ids stay unique', () => {
        const caseIds = KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES.map((entry) => entry.id);
        expect(new Set(caseIds).size).toBe(caseIds.length);
    });

    test('registers a runtime provider timeout fallback case', () => {
        expect(KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'contextoverflow_timeout_provider_judge_fallback_en',
                    runtimeProviderFixture: 'timeout',
                    expected: expect.objectContaining({
                        expectedRagDeterministic: true,
                        expectedRagLlmJudgeUsed: false,
                        expectedRagRecoveryAttempted: true,
                        runtimeRequiredRagRecoveryBeforeReasonFragments: ['llm_judge_failed'],
                    }),
                }),
            ])
        );
    });

    test('registers a compare-intent graph neighbor selection probe', () => {
        expect(KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'graphintent_compare_neighbor_selection_en',
                    expected: expect.objectContaining({
                        requiredGraphSuccessorTitles: [
                            'Ductile Polymer Cup Analogy',
                            'Reusable Polymer Vessel Analogy',
                        ],
                        minimumRagFullDocumentFragmentCounts: {
                            graph_neighbor_support: 1,
                        },
                        forbiddenGraphSuccessorTitles: ['Procedural Calibration Sequence'],
                        requiredGraphSuccessorRelationKinds: ['analogy'],
                        forbiddenGraphNeighborFragmentTitles: ['Procedural Calibration Sequence'],
                        minimumGraphIntentAlignedSuccessorCandidates: 2,
                        minimumGraphIntentMisalignedSuccessorCandidates: 1,
                        expectedGraphUsedMisalignedSuccessorFallback: false,
                    }),
                }),
            ])
        );
    });

    test('registers a runtime graph-neighbor source-missing hard-negative probe', () => {
        expect(KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'graphintent_missing_neighbor_source_window_en',
                    runtimeUnavailableSourcePaths: expect.arrayContaining([
                        'Knowledge_Base/graphintent/ductile polymer cup analogy.md',
                        'Knowledge_Base/graphintent/reusable polymer vessel analogy.md',
                    ]),
                    expected: expect.objectContaining({
                        runtimeAcceptedRagSufficiencyStatuses: ['borderline'],
                        runtimeAcceptedRagDegradationStates: ['partial_coverage'],
                        minimumRagSourceDecisionStatusCounts: {
                            source_window_unavailable: 1,
                        },
                        inMemoryMinimumRagSourceDecisionStatusCounts: {
                            read: 1,
                        },
                        runtimeRequiredRagFailureStages: ['parsing_source', 'graph_evidence'],
                        runtimeRequiredRagSufficiencyReasonFragments: ['graph_neighbor_evidence_missing'],
                        runtimeRequiredRagSourceDecisionReasonFragments: ['graph_neighbor_support'],
                        expectedRagRecoveryAttempted: true,
                        inMemoryExpectedRagRecoveryAttempted: false,
                        minimumGraphIntentAlignedSuccessorCandidates: 2,
                        minimumGraphIntentMisalignedSuccessorCandidates: 1,
                        expectedGraphUsedMisalignedSuccessorFallback: false,
                    }),
                }),
            ])
        );
    });

    test('registers a runtime multi-neighbor source-loss probe', () => {
        expect(KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'graphintent_multi_neighbor_source_loss_en',
                    runtimeUnavailableSourcePaths: expect.arrayContaining([
                        'Knowledge_Base/graphintent/ductile polymer cup analogy.md',
                        'Knowledge_Base/graphintent/reusable polymer vessel analogy.md',
                    ]),
                    expected: expect.objectContaining({
                        runtimeAcceptedRagSufficiencyStatuses: ['borderline'],
                        runtimeAcceptedRagDegradationStates: ['partial_coverage'],
                        minimumRagSourceDecisionStatusCounts: {
                            source_window_unavailable: 2,
                        },
                        inMemoryMinimumRagSourceDecisionStatusCounts: {
                            read: 1,
                        },
                        runtimeRequiredRagFailureStages: ['parsing_source', 'graph_evidence'],
                        runtimeRequiredRagSufficiencyReasonFragments: ['graph_neighbor_evidence_missing'],
                        runtimeRequiredRagSourceDecisionReasonFragments: ['graph_neighbor_support'],
                        expectedRagRecoveryAttempted: true,
                        inMemoryExpectedRagRecoveryAttempted: false,
                        requiredGraphSuccessorTitles: [
                            'Ductile Polymer Cup Analogy',
                            'Reusable Polymer Vessel Analogy',
                        ],
                        requiredGraphSuccessorRelationKinds: ['analogy'],
                    }),
                }),
            ])
        );
    });

    test('registers waterglass RAG claim-gate and preamble-leak runtime acceptance', () => {
        const expectedWaterglassReleaseAcceptance = expect.objectContaining({
            runtimeAnswerReleaseDecision: 'revise',
            runtimeRequiredFailedGateIds: expect.arrayContaining([
                'query_intent_alignment',
                'rag_claim_citation_support',
            ]),
            answerMustNotContain: expect.arrayContaining([
                '所有推理过程',
                '最终输出',
                '遵从您的指示',
            ]),
        });

        expect(KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'waterglass_explicit_scope_compact_zh',
                    expected: expectedWaterglassReleaseAcceptance,
                }),
                expect.objectContaining({
                    id: 'waterglass_explicit_scope_spaced_zh',
                    expected: expectedWaterglassReleaseAcceptance,
                }),
            ])
        );
    });

    test('registers causal and explicit deep RAG answer profile budget probes', () => {
        expect(KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'causal_answer_profile_budget_en',
                    query: 'why causal answer profile probe needs bounded evidence?',
                    expected: expect.objectContaining({
                        expectedRagBudget: {
                            maxFragments: 20,
                            maxCharsPerFragment: 1500,
                            maxTotalChars: 7600,
                        },
                        expectedRagRecoveryAttempted: false,
                        requirePlannerTitleHitDocumentIds: false,
                    }),
                }),
                expect.objectContaining({
                    id: 'contextoverflow_deep_profile_budget_en',
                    query: 'explain in detail overflow budget probe',
                    expected: expect.objectContaining({
                        expectedRagBudget: {
                            maxFragments: 24,
                            maxCharsPerFragment: 1600,
                            maxTotalChars: 9000,
                        },
                        expectedRagRecoveryAttempted: false,
                    }),
                }),
            ])
        );
    });

    test('registers conflicting evidence hard-negative probes', () => {
        expect(KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'conflicting_adjacent_evidence_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context', 'conflict']),
                        acceptedRagSufficiencyStatuses: ['borderline'],
                        acceptedRagDegradationStates: ['conflict'],
                        requiredRagFailureStages: ['context_assembly'],
                        answerMustNotContain: expect.arrayContaining([
                            'single stable calibration tolerance',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'conflicting_nonadjacent_section_evidence_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context', 'conflict']),
                        acceptedRagSufficiencyStatuses: ['borderline'],
                        acceptedRagDegradationStates: ['conflict'],
                        requiredRagFailureStages: ['context_assembly'],
                        answerMustNotContain: expect.arrayContaining([
                            'single stable calibration tolerance',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'conflicting_release_date_evidence_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context', 'conflict']),
                        acceptedRagSufficiencyStatuses: ['borderline'],
                        acceptedRagDegradationStates: ['conflict'],
                        requiredRagFailureStages: ['context_assembly'],
                        answerMustNotContain: expect.arrayContaining([
                            'stable migration release date',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'conflicting_state_status_evidence_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context', 'conflict']),
                        acceptedRagSufficiencyStatuses: ['borderline'],
                        acceptedRagDegradationStates: ['conflict'],
                        requiredRagFailureStages: ['context_assembly'],
                        answerMustContain: expect.arrayContaining(['enabled', 'disabled']),
                        answerMustNotContain: expect.arrayContaining([
                            'stable migration gate status',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'conflicting_quantity_limit_evidence_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context', 'conflict']),
                        acceptedRagSufficiencyStatuses: ['borderline'],
                        acceptedRagDegradationStates: ['conflict'],
                        requiredRagFailureStages: ['context_assembly'],
                        answerMustContain: expect.arrayContaining(['retry limit', '3', '5']),
                        answerMustNotContain: expect.arrayContaining([
                            'stable retry limit',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'conflicting_ownership_identity_evidence_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context', 'conflict']),
                        acceptedRagSufficiencyStatuses: ['borderline'],
                        acceptedRagDegradationStates: ['conflict'],
                        requiredRagFailureStages: ['context_assembly'],
                        answerMustContain: expect.arrayContaining(['deployment owner', 'Release Ops', 'Rollback Team']),
                        answerMustNotContain: expect.arrayContaining([
                            'stable deployment owner',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'conflicting_multi_document_ownership_identity_evidence_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context', 'conflict']),
                        acceptedRagSufficiencyStatuses: ['borderline'],
                        acceptedRagDegradationStates: ['conflict'],
                        requiredRagFailureStages: ['context_assembly'],
                        answerMustContain: expect.arrayContaining(['deployment owner', 'Release Ops', 'Rollback Team']),
                        answerMustNotContain: expect.arrayContaining([
                            'stable deployment owner',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'temporal_scoped_state_status_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context']),
                        forbiddenRagRoles: expect.arrayContaining(['conflict']),
                        acceptedRagSufficiencyStatuses: expect.arrayContaining(['sufficient', 'borderline']),
                        acceptedRagDegradationStates: ['none'],
                        answerMustContain: expect.arrayContaining(['enabled', 'current']),
                        answerMustNotContain: expect.arrayContaining([
                            'Conflicting evidence',
                            'immediate predecessors',
                            'likely next nodes',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'temporal_scoped_ownership_identity_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context']),
                        forbiddenRagRoles: expect.arrayContaining(['conflict']),
                        acceptedRagSufficiencyStatuses: expect.arrayContaining(['sufficient', 'borderline']),
                        acceptedRagDegradationStates: ['none'],
                        answerMustContain: expect.arrayContaining(['deployment owner', 'Release Ops', 'current']),
                        answerMustNotContain: expect.arrayContaining([
                            'Conflicting evidence',
                            'stable deployment owner',
                            'immediate predecessors',
                            'likely next nodes',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'environment_scoped_state_status_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context']),
                        forbiddenRagRoles: expect.arrayContaining(['conflict']),
                        acceptedRagSufficiencyStatuses: expect.arrayContaining(['sufficient', 'borderline']),
                        acceptedRagDegradationStates: ['none'],
                        answerMustContain: expect.arrayContaining(['enabled', 'staging']),
                        answerMustNotContain: expect.arrayContaining([
                            'Conflicting evidence',
                            'stable migration gate status',
                            'immediate predecessors',
                            'likely next nodes',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'environment_scoped_ownership_identity_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context']),
                        forbiddenRagRoles: expect.arrayContaining(['conflict']),
                        acceptedRagSufficiencyStatuses: expect.arrayContaining(['sufficient', 'borderline']),
                        acceptedRagDegradationStates: ['none'],
                        answerMustContain: expect.arrayContaining(['deployment owner', 'Release Ops', 'staging']),
                        answerMustNotContain: expect.arrayContaining([
                            'Conflicting evidence',
                            'stable deployment owner',
                            'immediate predecessors',
                            'likely next nodes',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'version_scoped_state_status_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context']),
                        forbiddenRagRoles: expect.arrayContaining(['conflict']),
                        acceptedRagSufficiencyStatuses: expect.arrayContaining(['sufficient', 'borderline']),
                        acceptedRagDegradationStates: ['none'],
                        answerMustContain: expect.arrayContaining(['enabled', 'version 1.0']),
                        answerMustNotContain: expect.arrayContaining([
                            'Conflicting evidence',
                            'stable migration gate status',
                            'immediate predecessors',
                            'likely next nodes',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'version_scoped_ownership_identity_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context']),
                        forbiddenRagRoles: expect.arrayContaining(['conflict']),
                        acceptedRagSufficiencyStatuses: expect.arrayContaining(['sufficient', 'borderline']),
                        acceptedRagDegradationStates: ['none'],
                        answerMustContain: expect.arrayContaining(['deployment owner', 'Release Ops', 'version 1.0']),
                        answerMustNotContain: expect.arrayContaining([
                            'Conflicting evidence',
                            'stable deployment owner',
                            'immediate predecessors',
                            'likely next nodes',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'platform_scoped_state_status_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context']),
                        forbiddenRagRoles: expect.arrayContaining(['conflict']),
                        acceptedRagSufficiencyStatuses: expect.arrayContaining(['sufficient', 'borderline']),
                        acceptedRagDegradationStates: ['none'],
                        answerMustContain: expect.arrayContaining(['enabled', 'Windows']),
                        answerMustNotContain: expect.arrayContaining([
                            'Conflicting evidence',
                            'stable migration gate status',
                            'immediate predecessors',
                            'likely next nodes',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'platform_scoped_ownership_identity_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context']),
                        forbiddenRagRoles: expect.arrayContaining(['conflict']),
                        acceptedRagSufficiencyStatuses: expect.arrayContaining(['sufficient', 'borderline']),
                        acceptedRagDegradationStates: ['none'],
                        answerMustContain: expect.arrayContaining(['deployment owner', 'Release Ops', 'Windows']),
                        answerMustNotContain: expect.arrayContaining([
                            'Conflicting evidence',
                            'stable deployment owner',
                            'immediate predecessors',
                            'likely next nodes',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'temporal_scoped_release_date_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context']),
                        forbiddenRagRoles: expect.arrayContaining(['conflict']),
                        acceptedRagSufficiencyStatuses: expect.arrayContaining(['sufficient', 'borderline']),
                        acceptedRagDegradationStates: ['none'],
                        answerMustContain: expect.arrayContaining(['2026-08-15', 'current']),
                        answerMustNotContain: expect.arrayContaining([
                            'Conflicting evidence',
                            'immediate predecessors',
                            'likely next nodes',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'temporal_scoped_planned_release_date_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context']),
                        forbiddenRagRoles: expect.arrayContaining(['conflict']),
                        acceptedRagSufficiencyStatuses: expect.arrayContaining(['sufficient', 'borderline']),
                        acceptedRagDegradationStates: ['none'],
                        answerMustContain: expect.arrayContaining(['2026-08-15', 'current']),
                        answerMustNotContain: expect.arrayContaining([
                            'Conflicting evidence',
                            'immediate predecessors',
                            'likely next nodes',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'temporal_cross_document_planned_release_date_probe_en',
                    expected: expect.objectContaining({
                        minCitations: 2,
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context']),
                        forbiddenRagRoles: expect.arrayContaining(['conflict']),
                        acceptedRagSufficiencyStatuses: expect.arrayContaining(['sufficient', 'borderline']),
                        acceptedRagDegradationStates: ['none'],
                        answerMustContain: expect.arrayContaining(['2026-08-15', '2026-09-20', 'planned']),
                        answerMustNotContain: expect.arrayContaining([
                            'Conflicting evidence',
                            'immediate predecessors',
                            'likely next nodes',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'conflicting_multi_document_evidence_probe_en',
                    expected: expect.objectContaining({
                        minCitations: 2,
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context', 'conflict']),
                        acceptedRagSufficiencyStatuses: ['borderline'],
                        acceptedRagDegradationStates: ['conflict'],
                        requiredRagFailureStages: ['context_assembly'],
                        answerMustContain: expect.arrayContaining(['+/-0.10 mm', '+/-0.50 mm']),
                        answerMustNotContain: expect.arrayContaining([
                            'single stable calibration tolerance',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'conflicting_multi_document_quantity_evidence_probe_en',
                    expected: expect.objectContaining({
                        minCitations: 2,
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context', 'conflict']),
                        acceptedRagSufficiencyStatuses: ['borderline'],
                        acceptedRagDegradationStates: ['conflict'],
                        requiredRagFailureStages: ['context_assembly'],
                        answerMustContain: expect.arrayContaining(['retry attempts', '3', '5']),
                        answerMustNotContain: expect.arrayContaining([
                            'single stable retry-attempt count',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'full_document_scan_remote_conflict_probe_en',
                    expected: expect.objectContaining({
                        minCitations: 2,
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context', 'conflict']),
                        acceptedRagSufficiencyStatuses: ['borderline'],
                        acceptedRagDegradationStates: ['conflict'],
                        requiredRagFailureStages: ['context_assembly'],
                        answerMustContain: expect.arrayContaining(['+/-0.10 mm', '+/-0.50 mm']),
                        answerMustNotContain: expect.arrayContaining([
                            'single stable calibration tolerance',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'repeated_snippet_target_section_probe_en',
                    expected: expect.objectContaining({
                        minCitations: 1,
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context']),
                        acceptedRagSufficiencyStatuses: expect.arrayContaining(['sufficient', 'borderline']),
                        answerMustContain: expect.arrayContaining([
                            'Target section context says the second occurrence controls the answer',
                        ]),
                        answerMustNotContain: expect.arrayContaining([
                            'Distractor section context belongs to the first occurrence',
                        ]),
                    }),
                }),
            ])
        );
    });

    test.each(KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES)(
        'conversation regression case: $id',
        async (caseEntry) => {
            const regressionPlatform = createRegressionPlatform(caseEntry);
            try {
                await regressionPlatform.platform.ingestKnowledge({
                    incremental: true,
                    documents: buildRegressionDocuments(),
                });

                const response = await regressionPlatform.platform.agentConversation(
                    deriveScopedConversationRequest(caseEntry)
                );
            const expected = caseEntry.expected;
            const minimumRagSourceDecisionStatusCounts = expected.inMemoryMinimumRagSourceDecisionStatusCounts
                || expected.minimumRagSourceDecisionStatusCounts;
            const expectedRagRecoveryAttempted = typeof expected.inMemoryExpectedRagRecoveryAttempted === 'boolean'
                ? expected.inMemoryExpectedRagRecoveryAttempted
                : expected.expectedRagRecoveryAttempted;
            const minimumRagRecoveryBeforeSourceDecisionStatusCounts = expected.inMemoryMinimumRagRecoveryBeforeSourceDecisionStatusCounts
                || expected.minimumRagRecoveryBeforeSourceDecisionStatusCounts;
            const citations = Array.isArray(response.citations) ? response.citations : [];
            const planner = response.trace.planner || {
                plannerQuery: null,
                titleLikeQueries: [],
                titleHitDocumentIds: [],
            };
            const retrieval = response.trace.retrieval || {
                retrievalModes: [],
            };
            const acceptedDecisions = Array.isArray(expected.acceptedAnswerReleaseDecisions)
                && expected.acceptedAnswerReleaseDecisions.length > 0
                ? expected.acceptedAnswerReleaseDecisions
                : (expected.answerReleaseDecision ? [expected.answerReleaseDecision] : []);

            expect(citations.length).toBeGreaterThanOrEqual(expected.minCitations);
            if (acceptedDecisions.length > 0) {
                expect(acceptedDecisions).toContain(response.answerReleaseReview?.decision);
            }
            expect(response.answerReleaseReview?.publicAnswer).toBe(response.answer);
            expect(response.trace.usedScope.scopeSource).toBe(expected.scopeSource);
            expect(response.knowledgePoints.length).toBeGreaterThan(0);
            expect(response.knowledgePoints[0]?.sourcePath).toBe(expected.primarySourcePath);
            expect(planner.titleLikeQueries).toEqual(
                expect.arrayContaining(expected.plannerTitleLikeQueries)
            );
            if (expected.requirePlannerTitleHitDocumentIds !== false) {
                expect(planner.titleHitDocumentIds.length).toBeGreaterThan(0);
            }
            expected.answerMustContain?.forEach((fragment) => {
                expect(response.answer).toContain(fragment);
            });
            expected.answerMustNotContain?.forEach((fragment) => {
                expect(response.answer).not.toContain(fragment);
            });
            if (expected.ragSourceBoundary) {
                expect(response.trace.ragContextPack).toEqual(expect.objectContaining({
                    sourceBoundary: expected.ragSourceBoundary,
                }));
            }
            if (expected.requiredRagRoles && expected.requiredRagRoles.length > 0) {
                const observedRagRoles = (response.trace.ragContextPack?.fragments || [])
                    .map((fragment) => fragment.role);
                expect(observedRagRoles).toEqual(expect.arrayContaining(expected.requiredRagRoles));
            }
            if (expected.forbiddenRagRoles && expected.forbiddenRagRoles.length > 0) {
                const observedRagRoles = (response.trace.ragContextPack?.fragments || [])
                    .map((fragment) => fragment.role);
                expected.forbiddenRagRoles.forEach((role) => {
                    expect(observedRagRoles).not.toContain(role);
                });
            }
            if (expected.minimumRagFullDocumentFragmentCounts) {
                const observedFullDocumentFragmentCounts = countFullDocumentRagFragmentsByRole(response);
                Object.entries(expected.minimumRagFullDocumentFragmentCounts).forEach(([role, minimumCount]) => {
                    expect(observedFullDocumentFragmentCounts[role as RagEvidenceRole] || 0)
                        .toBeGreaterThanOrEqual(minimumCount || 0);
                });
            }
            if (expected.acceptedRagSufficiencyStatuses && expected.acceptedRagSufficiencyStatuses.length > 0) {
                expect(expected.acceptedRagSufficiencyStatuses).toContain(response.trace.ragSufficiencyReview?.status);
            }
            expectRagBudget(response.trace.ragContextPack?.budget, expected.expectedRagBudget);
            if (expected.requiredRagFailureStages && expected.requiredRagFailureStages.length > 0) {
                expect(collectRagFailureStages(response)).toEqual(
                    expect.arrayContaining(expected.requiredRagFailureStages)
                );
            }
            if (expected.requiredFirstGraphSuccessorTitle) {
                expect(graphSuccessorTitles(response)[0]).toBe(expected.requiredFirstGraphSuccessorTitle);
            }
            if (expected.requiredGraphSuccessorTitles && expected.requiredGraphSuccessorTitles.length > 0) {
                expect(graphSuccessorTitles(response)).toEqual(
                    expect.arrayContaining(expected.requiredGraphSuccessorTitles)
                );
            }
            if (expected.forbiddenGraphSuccessorTitles && expected.forbiddenGraphSuccessorTitles.length > 0) {
                expected.forbiddenGraphSuccessorTitles.forEach((title) => {
                    expect(graphSuccessorTitles(response)).not.toContain(title);
                });
            }
            if (expected.requiredGraphSuccessorRelationKinds && expected.requiredGraphSuccessorRelationKinds.length > 0) {
                expect(graphSuccessorRelationKinds(response)).toEqual(
                    expect.arrayContaining(expected.requiredGraphSuccessorRelationKinds)
                );
            }
            if (expected.forbiddenGraphNeighborFragmentTitles && expected.forbiddenGraphNeighborFragmentTitles.length > 0) {
                expected.forbiddenGraphNeighborFragmentTitles.forEach((title) => {
                    expect(graphNeighborFragmentTitles(response)).not.toContain(title);
                });
            }
            const diagnostics = graphDiagnostics(response);
            if (typeof expected.minimumGraphIntentAlignedPredecessorCandidates === 'number') {
                expect(Number(diagnostics.intentAlignedPredecessorCandidateCount || 0))
                    .toBeGreaterThanOrEqual(expected.minimumGraphIntentAlignedPredecessorCandidates);
            }
            if (typeof expected.minimumGraphIntentAlignedSuccessorCandidates === 'number') {
                expect(Number(diagnostics.intentAlignedSuccessorCandidateCount || 0))
                    .toBeGreaterThanOrEqual(expected.minimumGraphIntentAlignedSuccessorCandidates);
            }
            if (typeof expected.minimumGraphIntentMisalignedPredecessorCandidates === 'number') {
                expect(Number(diagnostics.intentMisalignedPredecessorCandidateCount || 0))
                    .toBeGreaterThanOrEqual(expected.minimumGraphIntentMisalignedPredecessorCandidates);
            }
            if (typeof expected.minimumGraphIntentMisalignedSuccessorCandidates === 'number') {
                expect(Number(diagnostics.intentMisalignedSuccessorCandidateCount || 0))
                    .toBeGreaterThanOrEqual(expected.minimumGraphIntentMisalignedSuccessorCandidates);
            }
            if (typeof expected.expectedGraphUsedMisalignedPredecessorFallback === 'boolean') {
                expect(Boolean(diagnostics.usedIntentMisalignedPredecessorFallback))
                    .toBe(expected.expectedGraphUsedMisalignedPredecessorFallback);
            }
            if (typeof expected.expectedGraphUsedMisalignedSuccessorFallback === 'boolean') {
                expect(Boolean(diagnostics.usedIntentMisalignedSuccessorFallback))
                    .toBe(expected.expectedGraphUsedMisalignedSuccessorFallback);
            }
            if (typeof expected.expectedRagDeterministic === 'boolean') {
                expect(response.trace.ragSufficiencyReview?.deterministic).toBe(expected.expectedRagDeterministic);
            }
            if (typeof expected.expectedRagLlmJudgeUsed === 'boolean') {
                expect(response.trace.ragSufficiencyReview?.llmJudgeUsed).toBe(expected.expectedRagLlmJudgeUsed);
            }
            if (typeof expectedRagRecoveryAttempted === 'boolean') {
                expect(response.trace.ragSufficiencyReview?.recoveryAttempted).toBe(expectedRagRecoveryAttempted);
            }
            if (expected.acceptedRagDegradationStates && expected.acceptedRagDegradationStates.length > 0) {
                expect(expected.acceptedRagDegradationStates).toContain(response.trace.ragSufficiencyReview?.degradationState);
            }
            if (minimumRagSourceDecisionStatusCounts) {
                const observedDecisionCounts = countRagSourceDecisionStatuses(
                    response.trace.ragContextPack?.sourceDecisions
                );
                Object.entries(minimumRagSourceDecisionStatusCounts).forEach(([status, minimumCount]) => {
                    expect(observedDecisionCounts[status] || 0).toBeGreaterThanOrEqual(minimumCount || 0);
                });
            }
            if (minimumRagRecoveryBeforeSourceDecisionStatusCounts) {
                const observedRecoveryDecisionCounts = response.trace.ragRecovery?.beforeSourceDecisionStatusCounts || {};
                Object.entries(minimumRagRecoveryBeforeSourceDecisionStatusCounts).forEach(([status, minimumCount]) => {
                    expect(observedRecoveryDecisionCounts[status as keyof typeof observedRecoveryDecisionCounts] || 0)
                        .toBeGreaterThanOrEqual(minimumCount || 0);
                });
            }
            expectReasonFragments(
                response.trace.ragRecovery?.beforeReasons,
                expected.requiredRagRecoveryBeforeReasonFragments
            );
            if (expected.retrievalModes && expected.retrievalModes.length > 0) {
                expect(retrieval.retrievalModes).toEqual(
                    expect.arrayContaining(expected.retrievalModes)
                );
            }
            if (expected.recoveredSourcePaths && expected.recoveredSourcePaths.length > 0) {
                expect(retrieval.scopeRecovery?.recoveredSourcePaths || []).toEqual(
                    expect.arrayContaining(expected.recoveredSourcePaths)
                );
            }
            } finally {
                regressionPlatform.cleanup();
            }
        }
    );
});
