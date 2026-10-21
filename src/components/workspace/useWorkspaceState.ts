import { useState, useMemo, useEffect, useRef } from "react";
import { useApp } from "../../context/AppContext.tsx";
import {
  Assessment,
  DepartmentType,
  SampleType,
  AssessmentResult,
  SupportFaultCategory,
  SalesProject,
} from "../../types/index.ts";
import {
  getDefaultSupportScores,
  getDefaultSalesScores,
  calculateSupportTotal,
  calculateSalesTotal,
  calculateSalesMistakeScore,
  validateScores,
  getAllRubricItems,
} from "../../utils/scoring.ts";
import { getJalaliDateString, formatScoreBadge } from "../../utils/persian.ts";

export function useWorkspaceState(
  onAssessmentSubmitted?: (newId: string) => void,
) {
  const {
    agents,
    settings,
    faults,
    assessments,
    addAssessment,
    currentControllerId,
    supportRubric,
    salesRubric,
    supportFormVersion,
    salesFormVersion,
    supportFormId,
    salesFormId,
  } = useApp();

  // Selected agent state
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    agents[0]?.id || "",
  );
  const [agentSearch, setAgentSearch] = useState<string>("");
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] =
    useState<boolean>(false);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) || agents[0],
    [agents, selectedAgentId],
  );

  const formType: DepartmentType = selectedAgent?.department || "sales";

  // Common Metadata Fields
  const [sampleName, setSampleName] = useState<SampleType>("Random Sampling");
  const [vendorId, setVendorId] = useState<string>("");
  const [vendorTitle, setVendorTitle] = useState<string>("");
  const [checkDate, setCheckDate] = useState<string>(getJalaliDateString());
  const [faultId, setFaultId] = useState<string>("");
  const [backendGeneral, setBackendGeneral] = useState<boolean>(false);
  const [isFraud, setIsFraud] = useState<boolean>(false);
  const [result, setResult] = useState<AssessmentResult>("No problem");
  const [resultComment, setResultComment] = useState<string>("");

  // Support-Specific Fields
  const [ticketNumber, setTicketNumber] = useState<string>("");
  const [voiceLink, setVoiceLink] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [selectedFaultCategories, setSelectedFaultCategories] = useState<
    SupportFaultCategory[]
  >([]);

  // Sales-Specific Fields
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [project, setProject] = useState<SalesProject>("Campaign");
  const [discountOrCoupon, setDiscountOrCoupon] = useState<string>("");
  const [registrationDate, setRegistrationDate] = useState<string>(
    getJalaliDateString(),
  );
  const [executionDate, setExecutionDate] = useState<string>(
    getJalaliDateString(),
  );
  const [mistakeCount, setMistakeCount] = useState<number>(0);

  const activeRubric = formType === "support" ? supportRubric : salesRubric;
  const activeVersion =
    formType === "support" ? supportFormVersion : salesFormVersion;
  const activeFormId =
    formType === "support"
      ? supportFormId || `form-support-v${supportFormVersion}`
      : salesFormId || `form-sales-v${salesFormVersion}`;

  // Rubric Scores (Pre-filled to full score as an initial UI state)
  const [supportScores, setSupportScores] = useState<Record<string, number>>(
    () => getDefaultSupportScores(supportRubric),
  );
  const [salesScores, setSalesScores] = useState<Record<string, number>>(() =>
    getDefaultSalesScores(salesRubric),
  );

  // Sync scores with active rubric if rubric or form type changes
  useEffect(() => {
    if (formType === "support") {
      setSupportScores((prev) => {
        const merged: Record<string, number> = {};
        getAllRubricItems(supportRubric).forEach((it) => {
          merged[it.id] =
            prev[it.id] !== undefined ? prev[it.id] : it.maxPoints;
        });
        return merged;
      });
    } else {
      setSalesScores((prev) => {
        const merged: Record<string, number> = {};
        getAllRubricItems(salesRubric).forEach((it) => {
          merged[it.id] =
            prev[it.id] !== undefined ? prev[it.id] : it.maxPoints;
        });
        return merged;
      });
    }
  }, [formType, supportRubric, salesRubric]);

  const activeScores = formType === "support" ? supportScores : salesScores;

  // Real-time score validation
  const validation = useMemo(
    () => validateScores(activeRubric, activeScores),
    [activeRubric, activeScores],
  );

  const [submitToast, setSubmitToast] = useState<string | null>(null);

  // Check if selected fault is critical
  const selectedFault = faults.find((f) => f.id === faultId);
  const isCriticalFault = !!selectedFault?.is_critical;

  // Duplicate ticket check for the same agent
  const isDuplicateTicket = useMemo(() => {
    if (!ticketNumber || formType !== "support") return false;
    return assessments.some(
      (a) =>
        a.agent_id === selectedAgent?.id &&
        a.ticket_number?.trim().toLowerCase() ===
          ticketNumber.trim().toLowerCase(),
    );
  }, [ticketNumber, selectedAgent?.id, assessments, formType]);

  // Compute live scores safely
  const supportCalculation = useMemo(() => {
    try {
      if (!validateScores(supportRubric, supportScores).isValid) {
        let soft = 0;
        let know = 0;
        supportRubric.forEach((sec) => {
          let s = 0;
          sec.criteria.forEach((crit) => {
            crit.items.forEach((it) => {
              if (typeof supportScores[it.id] === "number")
                s += supportScores[it.id];
            });
          });
          if (sec.id.includes("soft")) soft += s;
          else know += s;
        });
        return {
          total: Math.min(100, soft + know),
          softSkill: soft,
          knowledge: know,
        };
      }
      return calculateSupportTotal(
        supportScores,
        isFraud,
        isCriticalFault,
        supportRubric,
      );
    } catch {
      return { total: 0, softSkill: 0, knowledge: 0 };
    }
  }, [supportScores, isFraud, isCriticalFault, supportRubric]);

  const salesCalculation = useMemo(() => {
    try {
      if (!validateScores(salesRubric, salesScores).isValid) {
        let soft = 0;
        let scr = 0;
        salesRubric.forEach((sec) => {
          let s = 0;
          sec.criteria.forEach((crit) => {
            crit.items.forEach((it) => {
              if (typeof salesScores[it.id] === "number")
                s += salesScores[it.id];
            });
          });
          if (sec.id.includes("soft")) soft += s;
          else scr += s;
        });
        const mistakeScore = calculateSalesMistakeScore(
          mistakeCount,
          settings.sales_mistake_deductions,
        );
        return {
          total: Math.min(100, soft + scr + mistakeScore),
          softSkill: soft,
          script: scr,
          mistakeScore,
        };
      }
      return calculateSalesTotal(
        salesScores,
        mistakeCount,
        isFraud,
        isCriticalFault,
        salesRubric,
        settings.sales_mistake_deductions,
      );
    } catch {
      return { total: 0, softSkill: 0, script: 0, mistakeScore: 0 };
    }
  }, [
    salesScores,
    mistakeCount,
    isFraud,
    isCriticalFault,
    salesRubric,
    settings.sales_mistake_deductions,
  ]);

  const totalScore =
    formType === "support" ? supportCalculation.total : salesCalculation.total;
  const scoreBadge = formatScoreBadge(totalScore, {
    high: settings.high_quality_threshold,
    low: settings.low_quality_threshold,
  });

  // Rubric Item Toggle and Step Handlers
  const handleToggleItem = (itemId: string, maxPoints: number) => {
    if (formType === "support") {
      setSupportScores((prev) => ({
        ...prev,
        [itemId]: prev[itemId] === maxPoints ? 0 : maxPoints,
      }));
    } else {
      setSalesScores((prev) => ({
        ...prev,
        [itemId]: prev[itemId] === maxPoints ? 0 : maxPoints,
      }));
    }
  };

  const handleSetItemScore = (
    itemId: string,
    maxPoints: number,
    valStr: string,
  ) => {
    const val = valStr === "" ? (undefined as any) : Number(valStr);
    if (formType === "support") {
      setSupportScores((prev) => ({
        ...prev,
        [itemId]: val,
      }));
    } else {
      setSalesScores((prev) => ({
        ...prev,
        [itemId]: val,
      }));
    }
  };

  const handleStepItem = (itemId: string, maxPoints: number, delta: number) => {
    if (formType === "support") {
      setSupportScores((prev) => {
        const cur = prev[itemId] !== undefined ? prev[itemId] : maxPoints;
        const next = Math.max(0, Math.min(maxPoints, cur + delta));
        return { ...prev, [itemId]: next };
      });
    } else {
      setSalesScores((prev) => {
        const cur = prev[itemId] !== undefined ? prev[itemId] : maxPoints;
        const next = Math.max(0, Math.min(maxPoints, cur + delta));
        return { ...prev, [itemId]: next };
      });
    }
  };

  // 1-Click Reset all items to full points
  const resetToFullScore = () => {
    if (formType === "support") {
      setSupportScores(getDefaultSupportScores(supportRubric));
    } else {
      setSalesScores(getDefaultSalesScores(salesRubric));
      setMistakeCount(0);
    }
    setIsFraud(false);
    setBackendGeneral(false);
    setFaultId("");
  };

  // Auto fill missing items with their maxPoints
  const handleFillMissingWithFull = () => {
    if (formType === "support") {
      setSupportScores((prev) => {
        const next = { ...prev };
        supportRubric.forEach((sec) =>
          sec.criteria.forEach((crit) =>
            crit.items.forEach((it) => {
              if (next[it.id] === undefined || next[it.id] === null) {
                next[it.id] = it.maxPoints;
              }
            }),
          ),
        );
        return next;
      });
    } else {
      setSalesScores((prev) => {
        const next = { ...prev };
        salesRubric.forEach((sec) =>
          sec.criteria.forEach((crit) =>
            crit.items.forEach((it) => {
              if (next[it.id] === undefined || next[it.id] === null) {
                next[it.id] = it.maxPoints;
              }
            }),
          ),
        );
        return next;
      });
    }
  };

  // Toggle fault category chip
  const toggleFaultCategory = (cat: SupportFaultCategory) => {
    setSelectedFaultCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const inFlight = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Submit assessment handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validation.isValid) {
      alert(`ثبت ارزیابی ممکن نیست: ${validation.error}`);
      return;
    }

    if (!selectedAgent) {
      alert("ابتدا یک کارشناس مجاز انتخاب کنید");
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setIsSubmitting(true);
    const newAssessmentData: Omit<Assessment, "id" | "created_at"> = {
      agent_id: selectedAgent.id,
      controller_id: currentControllerId,
      form_id: activeFormId,
      form_type: formType,
      form_version: activeVersion,
      sample_name: sampleName,
      vendor_id: vendorId,
      vendor_title: vendorTitle,
      check_date: checkDate,
      fault_id: faultId || undefined,
      backend_general: backendGeneral,
      is_fraud: isFraud,
      result: result,
      result_comment: resultComment,
      total_score: totalScore,

      // Support specific
      ticket_number: formType === "support" ? ticketNumber : undefined,
      voice_link: formType === "support" ? voiceLink : undefined,
      description: formType === "support" ? description : undefined,
      fault_categories:
        formType === "support" ? selectedFaultCategories : undefined,
      support_scores: formType === "support" ? supportScores : undefined,

      // Sales specific
      phone_number: formType === "sales" ? phoneNumber : undefined,
      project: formType === "sales" ? project : undefined,
      discount_or_coupon: formType === "sales" ? discountOrCoupon : undefined,
      registration_date: formType === "sales" ? registrationDate : undefined,
      execution_date: formType === "sales" ? executionDate : undefined,
      mistake_count: formType === "sales" ? mistakeCount : undefined,
      sales_scores: formType === "sales" ? salesScores : undefined,
    };

    try {
      const created = await addAssessment(newAssessmentData);
      setSubmitToast(`ارزیابی با موفقیت ثبت شد (شناسه: ${created.id})`);
      setTimeout(() => setSubmitToast(null), 4000);

      if (onAssessmentSubmitted) {
        onAssessmentSubmitted(created.id);
      }
    } catch {
      /* Shared error banner retains the entered form. */
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  };

  // Generate Zoodfood backend URL
  const zoodfoodUrl = vendorId.trim()
    ? `https://newbackend.zoodfood.com/vendor/${vendorId.trim()}/edit`
    : null;

  return {
    agents,
    settings,
    faults,
    currentControllerId,
    supportRubric,
    salesRubric,
    selectedAgent,
    selectedAgentId,
    setSelectedAgentId,
    agentSearch,
    setAgentSearch,
    isAgentDropdownOpen,
    setIsAgentDropdownOpen,
    formType,
    sampleName,
    setSampleName,
    vendorId,
    setVendorId,
    vendorTitle,
    setVendorTitle,
    checkDate,
    setCheckDate,
    faultId,
    setFaultId,
    selectedFault,
    backendGeneral,
    setBackendGeneral,
    isFraud,
    setIsFraud,
    result,
    setResult,
    resultComment,
    setResultComment,
    ticketNumber,
    setTicketNumber,
    voiceLink,
    setVoiceLink,
    description,
    setDescription,
    selectedFaultCategories,
    toggleFaultCategory,
    phoneNumber,
    setPhoneNumber,
    project,
    setProject,
    discountOrCoupon,
    setDiscountOrCoupon,
    registrationDate,
    setRegistrationDate,
    executionDate,
    setExecutionDate,
    mistakeCount,
    setMistakeCount,
    supportScores,
    salesScores,
    validation,
    submitToast,
    isCriticalFault,
    isDuplicateTicket,
    supportCalculation,
    salesCalculation,
    totalScore,
    scoreBadge,
    handleToggleItem,
    handleSetItemScore,
    handleStepItem,
    resetToFullScore,
    handleFillMissingWithFull,
    handleSubmit,
    isSubmitting,
    zoodfoodUrl,
  };
}
