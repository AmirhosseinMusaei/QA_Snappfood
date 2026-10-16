# سامانه کنترل کیفیت عملیات تجاری (SnappFood Commercial QA Portal)

A high-performance, RTL Persian web application designed for SnappFood commercial and operations quality assurance, inspired by modern QA platforms (Klaus, MaestroQA). It provides a deduction-based single-page split-screen evaluation workspace, dynamic rubrics for Support and Sales departments, 6-tier role-based access control (RBAC), audio waveform playback for call audits, dispute resolution workflows, and Jalali (Shamsi) analytics.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been aligned based on confirmed requirements:

- **Confirmed Decision 1 (Storage & Persistence)**: Browser LocalStorage with pre-populated realistic SnappFood seed data, alongside seamless JSON export, import, and reset features to allow testing, backing up, and demonstrating all flows reliably.
- **Confirmed Decision 2 (Call Audio Inspection)**: Interactive waveform player with multi-speed playback (0.75x, 1x, 1.25x, 1.5x, 2x), interactive scrubber, timestamp markers, and realistic audio playback for auditing call recordings.
- **Confirmed Decision 3 (Dispute Resolution Flow)**: Agents can submit an objection (اعتراض) within 3 days with specific feedback; the assigned QA Controller receives and resolves the dispute with revision comments and score adjustments.

---

## 1. Overview & Core Concept

### What It Does
The portal streamlines the end-to-end quality assurance lifecycle for SnappFood commercial teams. QA Controllers evaluate vendor calls and ticket interactions in a deduction-first workspace where forms default to 100/100 points ("No Problem") and controllers subtract points only for specific errors. Team Leads monitor their teams' audit coverage and review cases marked as "Need to check". Agents review their monthly performance, inspect lost points breakdowns, and file disputes. Supervisors and Admins oversee department-wide metrics, customize faults, and export reports.

### Target Audience & Personas
1. **Agents (کارشناسان)**: Review monthly scores, identify coaching areas, and submit disputes.
2. **Team Leads (سرپرستان تیم)**: Monitor team audit quotas (min 40 reviews/month) and review flagged calls.
3. **Managers (مدیران واحد)**: Compare Support vs. Sales metrics, track SLAs, and analyze fault trends.
4. **QA Controllers (کنترلرهای کیفیت)**: High-speed evaluation in the split-screen workspace, dispute handling.
5. **QA Supervisors & Admins (سوپروایزر و ادمین)**: Full system governance, audit logs, rubric configuration, and data exports.

### Key Value
Eliminates sluggish multi-step wizards in favor of a fast, keyboard-friendly split-screen workspace with immediate visual score calculations, automated Zoodfood vendor backend linking, and Persian-native Jalali reporting.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Top Navigation & Role Switcher                  │
│ [SnappFood QA Logo]  ·  [Workspace] [Audits] [Need to Check] [Analytics] │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌───────────────────────────────────┐       ┌───────────────────────────────────┐
│     Split-Screen QA Workspace     │       │       Role-Specific Dashboards    │
│  ┌──────────────┬──────────────┐  │       │ - Agent: Score trends & disputes  │
│  │ 65% Left:    │ 35% Right:   │  │       │ - Team Lead: "Need to Check" box  │
│  │ Interactive  │ Sticky Agent │  │       │ - Manager: Department benchmarks  │
│  │ Rubric Cards │ & Metadata   │  │       │ - Admin: User roster & rubrics    │
│  └──────────────┴──────────────┘  │       └───────────────────────────────────┘
└───────────────────────────────────┘
```

1. **Split-Screen Evaluation Flow**:
   - QA Controller selects an Agent from a searchable combobox (typing name or Source ID e.g., `3718`).
   - The system automatically detects the Agent's department and locks the rubric to **Support** or **Sales**.
   - Agent metadata (Team, Team Lead, Panel) auto-populates.
   - Typing a Vendor ID (e.g., `279168`) immediately activates a direct link to `https://newbackend.zoodfood.com/vendor/279168/edit`.
   - Audio call link activates the waveform player.
   - All rubric sub-items default to checked (100% full score). The controller unchecks missed points or increments mistakes.
   - Top sticky bar dynamically updates live subtotals, deductions, and score badge color.
   - Controller clicks "ثبت ارزیابی (Submit Assessment)" with confirmation toast.

2. **Agent Self-Service & Dispute Flow**:
   - Agent logs in (or switches role to `agent`), sees current Jalali month average, 3-month performance graph, and lost-points breakdown.
   - Opens an assessment, listens to the call recording, and if within 3 days, clicks "ثبت اعتراض (File Dispute)".
   - Enters objection reason and timestamp.
   - QA Controller sees pending dispute in their inbox, reviews objection, accepts/rejects with a comment, and optionally updates the score.

3. **Team Lead "Need to Check" Flow**:
   - Team Lead views dedicated inbox of assessments marked as `Need to check` by QA.
   - Reviews findings, adds leadership notes, and marks resolved.

### Visual Identity & Theme
- **Direction**: Clean, modern enterprise SaaS with high typographic scannability and minimal clutter.
- **Typography**: `Vazirmatn` font throughout, strict RTL text direction (`dir="rtl"`), and localized Persian digits (`۰۱۲۳۴۵۶۷۸۹`).
- **Color Tokens**:
  - Light Background: `#F8FAFC` (Slate 50)
  - Card Surfaces: `#FFFFFF` with `#E2E8F0` hairline border
  - Brand & Accent: `#0284C7` (Sky 600) & `#38BDF8` (Sky 400), Soft Sky `#E0F2FE`
  - Dark Theme: `#0F172A` canvas, `#1E293B` cards, `#334155` borders
  - Semantic Badges:
    - Excellent ($\ge 90$): Emerald `#16A34A` / `#DCFCE7`
    - Average ($70 - 89$): Amber `#D97706` / `#FEF3C7`
    - Critical ($< 70$): Rose `#E11D48` / `#FFE4E6`
- **Zero-Pill Discipline**: Metadata displayed as clean, unboxed text separated by typographic middots (`·`). Interactive filter tabs use clean segmented controls.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Deduction-Based Scoring Model (Default = 100)
- **Chosen Approach**: All rubric items start checked/awarded. QA only touches what went wrong.
- **Why**: Drastically reduces audit time per interaction (QA Controllers typically spend 70% of time clicking items that were done correctly in additive systems).
- **Alternative Considered**: Additive scoring from 0. Rejected because it slows down high-volume commercial QA operations.

### Decision 2: Single-Page Split Workspace Over Wizard
- **Chosen Approach**: Sticky right metadata column + scrollable left rubric card stream + top persistent score header.
- **Why**: Matches leading QA software (Klaus, MaestroQA), prevents context switching, keeps call playback accessible while grading.
- **Alternative Considered**: Multi-step wizard tabs. Rejected because inspectors need to jump between criteria while listening to call audio.

### Decision 3: LocalStorage with Realistic Seed + JSON Export/Import
- **Chosen Approach**: Rich client-side reactive store backed by LocalStorage, with seed data covering Support & Sales teams, controllers, leads, faults, and historical audits. Includes 1-click JSON backup and restore.
- **Why**: Provides zero-latency response, works offline, enables quick role switching, and preserves all user edits across browser reloads.

---

## 4. Technical Architecture & Data Strategy

### System & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                              App State Store                           │
│  (Assessments, Agents, Users, Teams, Faults, Active Role, Preferences) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│  Workspace (Split)   │ │  Role Dashboards     │ │  Global Header       │
│  ├─ Sticky Right:    │ │  ├─ Agent Dashboard  │ │  ├─ Role Switcher    │
│  │  Agent Selector   │ │  ├─ Team Lead Inbox  │ │  ├─ Dark Mode Toggle │
│  │  Vendor Linker    │ │  ├─ Manager Overview │ │  ├─ Data Backup/Reset│
│  │  Waveform Player  │ │  └─ Supervisor Table │ │  └─ Active User Chip │
│  ├─ Sticky Top Bar:  │ └──────────────────────┘ └──────────────────────┘
│  │  Score HUD & Bar  │
│  └─ Left Rubric:     │
│     ├─ Support Card  │
│     ├─ Sales Card    │
│     └─ Mistake Stepper
└──────────────────────┘
```

### Data Models

```typescript
// Assessment Entity
interface Assessment {
  id: string;
  agent_id: string;
  controller_id: string;
  form_type: 'support' | 'sales';
  sample_name: 'Support group' | 'bi-party' | 'Dislike' | 'Random Sampling' | 'if needed';
  vendor_id?: string;
  vendor_title?: string;
  check_date: string; // Jalali (e.g. 1403/07/24)
  fault_id?: string;
  backend_general: boolean; // Error caused by backend, no point penalty
  is_fraud: boolean;        // Fraudulent activity, score drops to 0
  result: 'No problem' | 'Need to check' | 'Coaching Required';
  result_comment?: string;
  
  // Support Specifics
  ticket_number?: string;
  voice_link?: string;
  fault_categories?: string[]; // Multi-select root causes
  support_scores?: Record<string, number>; // Section & item scores
  
  // Sales Specifics
  phone_number?: string;
  project?: 'All Project' | 'NCR' | 'Promotion' | 'Campaign' | 'Bi-Party';
  discount_or_coupon?: string;
  registration_date?: string;
  execution_date?: string;
  mistake_count?: number; // 0=30, 1=25, 2=20, 3=15, 4=10, >=5=0
  sales_scores?: Record<string, number>;
  
  // Computed Scores
  total_score: number;
  created_at: string;
  
  // Dispute State
  dispute?: {
    status: 'none' | 'pending' | 'resolved' | 'rejected';
    created_at: string;
    agent_comment: string;
    controller_comment?: string;
    resolved_at?: string;
    original_score?: number;
  };
}
```

### Rubrics Breakdown

1. **Support Rubric (Total = 100)**:
   - **Soft Skill (60 pts)**:
     - استاندارد شروع (0-4 pts: سلام 1, معرفی کارشناس 1, معرفی شرکت 1, چک وندور 1)
     - گوش دادن فعال (0-5 pts)
     - درک و اطمینان به وندور (0-8 pts: درک مشکل 4, اطمینان به وندور 4)
     - همدلی، همدردی و تن صدا (0-15 pts: همدلی 5, حسن برخورد 5, تن صدا 5)
     - سوال باز پرسیدن (0-5 pts)
     - عدم قطع صحبت و سرعت مکالمه (0-5 pts: عدم قطع 3, سرعت 2)
     - مدیریت تماسهای چالشی (0-6 pts)
     - سکوت بیمورد و هلد (0-6 pts: سکوت 2, هلد 2, مدیریت زمان 2)
     - پایان مکالمه (0-6 pts: کوئری 2, نظرسنجی 2, خداحافظی 2)
   - **Knowledge (40 pts)**:
     - دقت و تمرکز (0-6 pts)
     - آموزش به وندور (0-8 pts)
     - دانش سیستم و رعایت پروسه (0-6 pts: دانش سیستم 3, رعایت پروسه 3)
     - تشخیص و حل مشکل در اولین تیکت FTR/FCR (0-6 pts)
     - رعایت قوانین سازمان و محرمانگی (0-4 pts)
     - انتخاب ریزن، ریزالت و کامنت (0-6 pts: ریزن/ریزالت 3, کامنت 3)
     - چک کردن تیکتهای قبلی (0-4 pts)

2. **Sales Rubric (Total = 100)**:
   - **Soft Skill (29 pts)**:
     - صحبت شفاف و ایجاد اعتماد (0-5 pts)
     - حفظ لحن محترمانه (0-5 pts)
     - کنترل احساسات و آرامش هنگام اعتراض (0-5 pts)
     - همدلی با مشتری (0-4 pts)
     - متقاعدسازی اصولی (0-5 pts)
     - انعطافپذیری در مذاکره (0-5 pts)
   - **Script (41 pts)**:
     - شفافیت و وضوح در مذاکره (0-6 pts)
     - شروع و پایان استاندارد (0-8 pts)
     - رعایت کامل اسکریپت مربوط به پروژه (0-8 pts)
     - جمعبندی نکات کلیدی (0-5 pts)
     - تلاش موثر برای پیشبرد مذاکره (0-5 pts)
     - عدم ارائه توضیحات خارج از اسکریپت (0-4 pts)
     - عدم راهنمایی و ارجاع نادرست (0-5 pts)
   - **Mistake & Fraud (30 pts)**:
     - 0 خطا = 30 امتیاز
     - 1 خطا = 25 امتیاز (-5)
     - 2 خطا = 20 امتیاز (-10)
     - 3 خطا = 15 امتیاز (-15)
     - 4 خطا = 10 امتیاز (-20)
     - 5+ خطا = 0 امتیاز (-30)
   - **Fraud Rules**:
     - ارزیابی تکی: در صورت تقلب یا خطای بحرانی، نمره ارزیابی صفر می‌شود.
     - معدل ماهانه: ۱ تقلب = ۱۰ نمره کسر از کل معدل ماهانه؛ بیشتر از ۱ تقلب = نمره ماهانه کارشناس صفر.

---

## 5. Verification & Testing Strategy (Ultra Mode)

1. **Unit Tests (Pure Scoring & Logic)**:
   - Test Support rubric scoring sum and subtotal calculation.
   - Test Sales rubric mistake point deductions (`0 -> 30`, `1 -> 25`, `2 -> 20`, ..., `>=5 -> 0`).
   - Test Fraud rule evaluation: single assessment zeroing, monthly score penalty calculation (`1 fraud -> -10`, `>1 fraud -> 0`).
   - Test duplicate ticket validation warning.
2. **Interactive UI Verification via Browser**:
   - Verify RTL Persian typography (`Vazirmatn`) and Persian numeral formatting.
   - Verify Split-Screen workspace responsive layout: sticky right metadata panel, left rubric cards, sticky top score bar.
   - Test vendor backend dynamic URL generation on Vendor ID change.
   - Test deduction interactions: unchecking sub-items updates score live; click "Reset to 100" restores full score.
   - Test role switching across all 6 roles (`agent`, `team_lead`, `manager`, `qa_controller`, `qa_supervisor`, `admin`).
   - Test dispute submission by agent and resolution by QA Controller.
