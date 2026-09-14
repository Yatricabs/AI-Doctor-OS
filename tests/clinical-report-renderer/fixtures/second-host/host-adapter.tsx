"use client";
// Test-only host adapters for clinical-report-renderer host-equivalence verification.
//
// This module is imported ONLY by the clinical-report-renderer test suite
// (host-equivalence.spec.ts and the node contract script). It is excluded from
// production exports and application bundles. It intentionally registers no
// fetcher, generator, patient-workflow state, route-derived policy, or clinical
// classifier: each adapter receives a prebuilt ClinicalReportIR plus presentation
// options and renders the SAME ClinicalReportRenderer. The only intentional
// difference between the two adapters is a minimal alternate layout wrapper/theme
// so host equivalence is observable without changing semantic content, hierarchy,
// citations, links, source order, explicit priorities, or state behavior.
import type { ReactElement } from "react";
import DefaultClinicalReportRenderer from "@/components/clinical-report-renderer/ClinicalReportRenderer";
import type { ClinicalReportIR } from "@/lib/clinical-report-renderer/types";

// The public host adapter shape. Both the primary-host adapter and the second-host
// adapter accept exactly this: a prebuilt IR and the renderer's presentation
// options. Neither accepts a fetcher, generator, workflow state, route policy, or
// classifier. Any safe-link policy/context is applied at the parser boundary
// (before the IR exists); the adapters never infer it from URL or environment.
//
// `Renderer` is an optional injection of the SAME ClinicalReportRenderer. It exists
// only so the test harness can supply the renderer compiled under its classic-JSX
// module loader (see host-equivalence.spec.ts / browser-verification.spec.ts); when
// omitted, the production ClinicalReportRenderer is used. It is never a different
// renderer and never adds host-specific interpretation.
type RendererComponent = (props: { ir: ClinicalReportIR; className?: string }) => ReactElement;
export type HostPresentationOptions = { className?: string };
export type HostAdapterProps = { ir: ClinicalReportIR; options?: HostPresentationOptions; Renderer?: RendererComponent };

// A capability record proving what each adapter does and does not register. Tests
// assert against this to enforce fixture isolation. Every field is a static,
// declared boolean; there is no runtime registration surface at all.
export type HostCapabilities = {
  registersFetcher: false;
  registersGenerator: false;
  registersWorkflowState: false;
  registersRoutePolicy: false;
  registersClinicalClassifier: false;
  rendersClinicalReportRenderer: true;
  // The adapter consumes an already-resolved IR; it does not derive safe-link
  // policy/context. Policy/context is supplied explicitly at the parser boundary.
  infersSafeLinkPolicyOrContext: false;
};

const SHARED_CAPABILITIES: HostCapabilities = {
  registersFetcher: false,
  registersGenerator: false,
  registersWorkflowState: false,
  registersRoutePolicy: false,
  registersClinicalClassifier: false,
  rendersClinicalReportRenderer: true,
  infersSafeLinkPolicyOrContext: false,
};

// Primary-host test adapter: a thin wrapper that renders ClinicalReportRenderer the
// way PatientsScreen/AIResponse do (passing only ir + className). This mirrors the
// production primary host's public shape so both hosts can be driven identically.
export function PrimaryHostAdapter({ ir, options, Renderer = DefaultClinicalReportRenderer }: HostAdapterProps) {
  return (
    <div className="crr-primary-host" data-host="primary">
      <Renderer ir={ir} className={options?.className ?? ""} />
    </div>
  );
}
PrimaryHostAdapter.hostName = "primary" as const;
PrimaryHostAdapter.capabilities = SHARED_CAPABILITIES;

// Second-host test fixture adapter: same public shape, same ClinicalReportRenderer,
// same IR + presentation options. It differs ONLY by a minimal alternate layout
// wrapper/theme (a different wrapper element/className). It adds no semantic
// content and no host-specific interpretation.
export function SecondHostAdapter({ ir, options, Renderer = DefaultClinicalReportRenderer }: HostAdapterProps) {
  return (
    <section className="crr-second-host crr-alt-theme" data-host="second">
      <div className="crr-alt-layout-wrapper">
        <Renderer ir={ir} className={options?.className ?? ""} />
      </div>
    </section>
  );
}
SecondHostAdapter.hostName = "second" as const;
SecondHostAdapter.capabilities = SHARED_CAPABILITIES;

export const HOST_ADAPTERS = [PrimaryHostAdapter, SecondHostAdapter] as const;
