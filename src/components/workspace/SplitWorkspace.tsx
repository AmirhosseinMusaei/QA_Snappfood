import React from "react";
import { WorkspaceScoreSummary } from "./WorkspaceScoreSummary.tsx";
import { WorkspaceMetadataPanel } from "./WorkspaceMetadataPanel.tsx";
import { WorkspaceRubricPanel } from "./WorkspaceRubricPanel.tsx";
import { useWorkspaceState } from "./useWorkspaceState.ts";

export const SplitWorkspace: React.FC<{
  onAssessmentSubmitted?: (newId: string) => void;
}> = ({ onAssessmentSubmitted }) => {
  const ws = useWorkspaceState(onAssessmentSubmitted);

  return (
    <div className="pb-16">
      {/* 1. TOP STICKY LIVE SCORE HUD BAR */}
      <WorkspaceScoreSummary
        isSubmitting={ws.isSubmitting}
        formType={ws.formType}
        supportCalculation={ws.supportCalculation}
        salesCalculation={ws.salesCalculation}
        mistakeCount={ws.mistakeCount}
        isFraud={ws.isFraud}
        isCriticalFault={ws.isCriticalFault}
        totalScore={ws.totalScore}
        scoreBadge={ws.scoreBadge}
        validation={ws.validation}
        submitToast={ws.submitToast}
        onResetToFull={ws.resetToFullScore}
        onSubmit={ws.handleSubmit}
      />

      {/* 2. SPLIT-SCREEN WORKSPACE LAYOUT (35% Right Context, 65% Left Rubric) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ========================================================= */}
          {/* RIGHT PANEL (Sticky Context & Metadata - 35% / 4-5 cols) */}
          {/* ========================================================= */}
          <WorkspaceMetadataPanel
            selectedAgent={ws.selectedAgent}
            agents={ws.agents}
            selectedAgentId={ws.selectedAgentId}
            setSelectedAgentId={ws.setSelectedAgentId}
            agentSearch={ws.agentSearch}
            setAgentSearch={ws.setAgentSearch}
            isAgentDropdownOpen={ws.isAgentDropdownOpen}
            setIsAgentDropdownOpen={ws.setIsAgentDropdownOpen}
            currentControllerId={ws.currentControllerId}
            formType={ws.formType}
            sampleName={ws.sampleName}
            setSampleName={ws.setSampleName}
            checkDate={ws.checkDate}
            setCheckDate={ws.setCheckDate}
            vendorId={ws.vendorId}
            setVendorId={ws.setVendorId}
            vendorTitle={ws.vendorTitle}
            setVendorTitle={ws.setVendorTitle}
            zoodfoodUrl={ws.zoodfoodUrl}
            ticketNumber={ws.ticketNumber}
            setTicketNumber={ws.setTicketNumber}
            isDuplicateTicket={ws.isDuplicateTicket}
            voiceLink={ws.voiceLink}
            setVoiceLink={ws.setVoiceLink}
            selectedFaultCategories={ws.selectedFaultCategories}
            toggleFaultCategory={ws.toggleFaultCategory}
            phoneNumber={ws.phoneNumber}
            setPhoneNumber={ws.setPhoneNumber}
            project={ws.project}
            setProject={ws.setProject}
            discountOrCoupon={ws.discountOrCoupon}
            setDiscountOrCoupon={ws.setDiscountOrCoupon}
            registrationDate={ws.registrationDate}
            setRegistrationDate={ws.setRegistrationDate}
            executionDate={ws.executionDate}
            setExecutionDate={ws.setExecutionDate}
            faultId={ws.faultId}
            setFaultId={ws.setFaultId}
            faults={ws.faults}
            selectedFault={ws.selectedFault}
            backendGeneral={ws.backendGeneral}
            setBackendGeneral={ws.setBackendGeneral}
            isFraud={ws.isFraud}
            setIsFraud={ws.setIsFraud}
            result={ws.result}
            setResult={ws.setResult}
            resultComment={ws.resultComment}
            setResultComment={ws.setResultComment}
          />

          {/* ========================================================= */}
          {/* LEFT PANEL (Interactive Rubric & Scoring - 65% / 7 cols)  */}
          {/* ========================================================= */}
          <WorkspaceRubricPanel
            formType={ws.formType}
            validation={ws.validation}
            supportRubric={ws.supportRubric}
            salesRubric={ws.salesRubric}
            supportScores={ws.supportScores}
            salesScores={ws.salesScores}
            mistakeCount={ws.mistakeCount}
            setMistakeCount={ws.setMistakeCount}
            onToggleItem={ws.handleToggleItem}
            onSetItemScore={ws.handleSetItemScore}
            onStepItem={ws.handleStepItem}
            onFillMissingWithFull={ws.handleFillMissingWithFull}
          />
        </div>
      </div>
    </div>
  );
};
