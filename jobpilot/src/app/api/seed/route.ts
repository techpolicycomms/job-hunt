// POST /api/seed — Seeds Rahul's full profile and 17 role lenses.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Sign in first" }, { status: 401 });
    }

    // STEP 1: Create/update profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          name: "Rahul Jha",
          email: "rjha1909@gmail.com",
          phone: "+41 78818 6778",
          address: "Geneva, Switzerland",
          linkedin: "https://linkedin.com/in/r-jha",
          nationality: "Indian",
          work_permit: "Swiss Permis B",
          years_experience: 11,
          languages: [
            { language: "English", level: "Native" },
            { language: "French", level: "B2" },
            { language: "Hindi", level: "Native" },
            { language: "Maithili", level: "Native" },
          ],
          education: [
            {
              degree: "PhD candidate, Management",
              institution: "University of Geneva",
              period: "2021-present",
            },
            {
              degree: "MBA",
              institution: "IMT Ghaziabad",
              exchange: "HHL Leipzig",
              period: "2012-2014",
            },
            {
              degree: "BE, Telecommunications",
              institution: "University of Pune",
              period: "2005-2009",
            },
          ],
          certifications: [
            "CAPM, PMI (2025)",
            "ISC2 Certified in Cybersecurity (2024)",
            "Governance of AI, UNSSC (2024)",
            "AI & ML, Aptech (2020-21)",
            "Digital Product Management, Nuclio (2021)",
            "Power BI, Microsoft (2020)",
          ],
          publications: [
            "Routledge Handbook of AI and Philanthropy (2024)",
            "UN DPI Investment Google case study (in development)",
            "MSME Cyber Readiness Index, ITU-WTO (forthcoming)",
          ],
          achievements: [
            "Scaled ITU SME Programme from 0 to 9,000 members in 180+ countries",
            "Led AI integration for ITU Innovation Centre including Google Gemini roadmap",
            "Raised CHF 1.2M annually through corporate partnerships",
            "Co-designed ISO 14001 EMS framework for ITU",
          ],
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (profileError) throw new Error(`Profile error: ${profileError.message}`);

    const profileId = profile.id;

    // STEP 2: Create 17 role lenses
    const lenses = [
      // ---- ITU 2021-Present (5 lenses) ----
      {
        profile_id: profileId,
        stint_name: "ITU 2021-Present",
        period: "2021-Present",
        organization: "International Telecommunication Union (ITU)",
        lens_id: "itu21_innovation",
        title: "Innovation and Partnership Lead",
        tags: ["innovation", "AI", "partnerships", "digital transformation", "technology",
               "product management", "startup", "ecosystem", "google", "gemini"],
        summary: "Led digital innovation and AI integration at ITU Innovation Centre, building partnerships with Geneva-based tech ecosystems and managing the development team.",
        bullets: [
          "Led AI integration initiative, evaluating Google Gemini and producing adoption roadmap for ITU",
          "Built and managed 8-person development team for ITU Innovation Centre in Delhi",
          "Modernized publications and knowledge management systems",
          "Strengthened strategic partnerships with FONGIT, EPFL, and Geneva tech ecosystems",
        ],
        sort_order: 1,
      },
      {
        profile_id: profileId,
        stint_name: "ITU 2021-Present",
        period: "2021-Present",
        organization: "International Telecommunication Union (ITU)",
        lens_id: "itu21_sustainability",
        title: "Digital Analyst — EMS & Green Digital Action",
        tags: ["sustainability", "environment", "EMS", "ISO 14001", "climate", "green",
               "ESG", "procurement", "carbon", "waste", "GHG"],
        summary: "Focal point bridging ITU's Environmental Management System with the Green Digital Action initiative, embedding sustainability into procurement and operations.",
        bullets: [
          "Served as focal point linking EMS and Green Digital Action frameworks",
          "Co-designed ITU's ISO 14001 Environmental Management System framework",
          "Improved Greening the Blue inventory accuracy and reporting",
          "Embedded GHG Protocol into procurement and supply chain processes",
          "Co-designed Green Digital Action Summit at GITEX Europe",
        ],
        sort_order: 2,
      },
      {
        profile_id: profileId,
        stint_name: "ITU 2021-Present",
        period: "2021-Present",
        organization: "International Telecommunication Union (ITU)",
        lens_id: "itu21_partnerships",
        title: "Senior Programme & Partnerships Manager",
        tags: ["partnerships", "fundraising", "resource mobilization", "B2B", "donor",
               "CRM", "stakeholder", "business development", "sales", "revenue", "account"],
        summary: "Led corporate partnerships and fundraising for ITU's Climate AI Centre and Green Digital Action Summit, converting one-off donors to long-term partners.",
        bullets: [
          "Led partnerships for Climate AI Centre ahead of COP30",
          "Designed and delivered Green Digital Action Summit at GITEX Europe",
          "Converted one-off event donors to long-term strategic partners",
          "Advised C-suite leadership on corporate partnership strategy",
          "Delivered pitch presentations to C-suite executives and government officials",
        ],
        sort_order: 3,
      },
      {
        profile_id: profileId,
        stint_name: "ITU 2021-Present",
        period: "2021-Present",
        organization: "International Telecommunication Union (ITU)",
        lens_id: "itu21_cybersecurity",
        title: "Digital Analyst — Cybersecurity & Data Policy",
        tags: ["cybersecurity", "data governance", "policy", "regulation", "compliance",
               "data analysis", "index", "benchmarking", "security", "ISC2"],
        summary: "Developed cybersecurity indices and data governance frameworks with WTO, applying ISC2 knowledge to multi-stakeholder cybersecurity policy research.",
        bullets: [
          "Co-developed MSME cyber-readiness index in collaboration with WTO",
          "Applied ISC2 cybersecurity certification knowledge to policy work",
          "Led data collection and validation for global benchmarking studies",
          "Facilitated multi-stakeholder consultations on cybersecurity policy",
          "Contributed AI governance chapter to Routledge Handbook (2024)",
        ],
        sort_order: 4,
      },
      {
        profile_id: profileId,
        stint_name: "ITU 2021-Present",
        period: "2021-Present",
        organization: "International Telecommunication Union (ITU)",
        lens_id: "itu21_project_mgmt",
        title: "Programme Manager — Digital Transformation",
        tags: ["project management", "programme management", "coordination", "planning",
               "monitoring", "evaluation", "budget", "reporting", "UN", "multilateral", "CAPM"],
        summary: "Managed a cross-functional portfolio spanning innovation, sustainability, and partnerships, using CAPM methodology and Agile sprint workflows.",
        bullets: [
          "Managed cross-functional portfolio: innovation, sustainability, and partnerships",
          "Implemented Agile sprint workflows and milestone tracking for 8-person team",
          "Delivered multi-country programmes with ministerial-level engagements",
          "Applied CAPM methodology for planning, risk management, and budget oversight",
          "Produced analytical reports and dashboards using Power BI",
        ],
        sort_order: 5,
      },

      // ---- ITU 2016-2019 (5 lenses) ----
      {
        profile_id: profileId,
        stint_name: "ITU 2016-2019",
        period: "2016-2019",
        organization: "International Telecommunication Union (ITU)",
        lens_id: "itu16_programme",
        title: "Programme Officer — SME Digital Innovation",
        tags: ["programme management", "SME", "digital inclusion", "innovation", "startup",
               "scaling", "platform", "community", "entrepreneurship"],
        summary: "Scaled the ITU SME Programme from zero to 9,000 members across 180+ countries, running global challenges connecting startups with investors and policymakers.",
        bullets: [
          "Scaled ITU SME Programme from 0 to 9,000 members in 180+ countries",
          "Designed and ran global challenges connecting startups with investors",
          "Organized multi-country events at ministerial level",
          "Represented ITU at AI for Good and WSIS Forum sessions",
        ],
        sort_order: 6,
      },
      {
        profile_id: profileId,
        stint_name: "ITU 2016-2019",
        period: "2016-2019",
        organization: "International Telecommunication Union (ITU)",
        lens_id: "itu16_policy",
        title: "Programme Officer — Digital Policy",
        tags: ["policy", "stakeholder engagement", "multilateral", "governance", "regulation",
               "consultation", "advocacy", "international development"],
        summary: "Led ministerial-level consultations across South Asia, Americas, and Africa, building cross-UN partnerships on digital policy and responsible AI.",
        bullets: [
          "Led ministerial consultations across South Asia, Americas, and Africa",
          "Built cross-UN partnerships with ILO, UNCTAD, ITC, and WTO",
          "Co-developed cyber-readiness index with WTO",
          "Organized global summits on responsible AI and digital governance",
        ],
        sort_order: 7,
      },
      {
        profile_id: profileId,
        stint_name: "ITU 2016-2019",
        period: "2016-2019",
        organization: "International Telecommunication Union (ITU)",
        lens_id: "itu16_partnerships",
        title: "Programme Officer — Partnerships",
        tags: ["partnerships", "fundraising", "resource mobilization", "donor", "B2B",
               "sponsorship", "revenue", "sales", "account management"],
        summary: "Led fundraising for the SME Platform, managing donor relationships across 50+ countries and pitching to 100+ startups and VCs.",
        bullets: [
          "Led fundraising strategy for ITU SME Platform",
          "Organized pitch events connecting 100+ startups with VC investors",
          "Managed donor relationships across 50+ countries",
          "Developed multi-year partnership proposals and donor reports",
        ],
        sort_order: 8,
      },
      {
        profile_id: profileId,
        stint_name: "ITU 2016-2019",
        period: "2016-2019",
        organization: "International Telecommunication Union (ITU)",
        lens_id: "itu16_research",
        title: "Programme Officer — Research & Publications",
        tags: ["research", "publications", "writing", "analysis", "data", "academic",
               "policy research", "content", "editorial"],
        summary: "Led research, data analysis, and editorial workflows for ITU publications and WSIS/AI for Good conference outputs.",
        bullets: [
          "Developed cyber-readiness index methodology, survey, and statistical analysis",
          "Produced research publications for WSIS and AI for Good conferences",
          "Conducted consultations across 10+ regions for global policy reports",
          "Managed editorial workflows for ITU publications and knowledge products",
        ],
        sort_order: 9,
      },
      {
        profile_id: profileId,
        stint_name: "ITU 2016-2019",
        period: "2016-2019",
        organization: "International Telecommunication Union (ITU)",
        lens_id: "itu16_vendor_ops",
        title: "Programme Officer — Vendor Operations",
        tags: ["operations", "vendor", "procurement", "SLA", "budget", "logistics",
               "service providers", "contract", "governance", "escalation", "onboarding"],
        summary: "Managed end-to-end vendor operations for 5-10 ministerial events annually across Europe and Asia, overseeing CHF 500K–1M in annual vendor budgets.",
        bullets: [
          "End-to-end vendor operations for 5-10 ministerial events (500-2000 attendees, 5-15 providers)",
          "Negotiated Host Country Agreements across Europe and Asia",
          "Vendor governance: contracts, POs, invoicing, and CHF 500K-1M annual budgets",
          "Resolved escalations including underperformance, budget overruns, and timeline pivots",
          "Coordinated cross-UN joint vendor arrangements",
        ],
        sort_order: 10,
      },

      // ---- ITU 2014-2016 (4 lenses) ----
      {
        profile_id: profileId,
        stint_name: "ITU 2014-2016",
        period: "2014-2016",
        organization: "International Telecommunication Union (ITU)",
        lens_id: "itu14_fundraising",
        title: "Programme Support — Resource Mobilization",
        tags: ["fundraising", "resource mobilization", "donor", "revenue", "sales", "B2B",
               "CRM", "account management"],
        summary: "Raised CHF 1.2M annually through 80+ donor relationships, converting ad-hoc supporters to multi-year partners with a 55% retention increase.",
        bullets: [
          "Raised CHF 1.2M annually through corporate and government partnerships",
          "Managed 80+ donor relationships with 55% retention increase",
          "Converted ad-hoc donors to multi-year strategic partners",
          "Developed proposals and impact reports for donor stewardship",
        ],
        sort_order: 11,
      },
      {
        profile_id: profileId,
        stint_name: "ITU 2014-2016",
        period: "2014-2016",
        organization: "International Telecommunication Union (ITU)",
        lens_id: "itu14_comms",
        title: "Programme Support — Communications & Marketing",
        tags: ["communications", "marketing", "content", "outreach", "publications",
               "events", "branding", "stakeholder"],
        summary: "Developed communication strategies and stakeholder materials for ITU programmes, achieving 50% cost reduction through content optimization.",
        bullets: [
          "Developed catalogue and content strategies for ITU publications",
          "Created stakeholder communications and outreach materials",
          "Achieved 50% cost reduction in production through process optimization",
        ],
        sort_order: 12,
      },
      {
        profile_id: profileId,
        stint_name: "ITU 2014-2016",
        period: "2014-2016",
        organization: "International Telecommunication Union (ITU)",
        lens_id: "itu14_operations",
        title: "Programme Support — Operations & Coordination",
        tags: ["operations", "coordination", "administration", "logistics", "support", "reporting"],
        summary: "Provided operational backbone for programme delivery, reporting for 80+ partners and streamlining internal coordination processes.",
        bullets: [
          "Provided operational support across multiple ITU programmes",
          "Managed reporting cycle for 80+ partners",
          "Streamlined internal coordination and administrative processes",
        ],
        sort_order: 13,
      },
      {
        profile_id: profileId,
        stint_name: "ITU 2014-2016",
        period: "2014-2016",
        organization: "International Telecommunication Union (ITU)",
        lens_id: "itu14_vendor_ops",
        title: "Programme Support — Vendor Ops & Budget",
        tags: ["vendor", "operations", "budget", "procurement", "invoice", "contract",
               "PO", "onboarding", "service providers", "CRM"],
        summary: "Managed vendor onboarding, contracts, and CHF 1.2M annual budget cycle, reducing vendor process costs by 50%.",
        bullets: [
          "Managed vendor operations for conferences: onboarding, contracts, POs, invoicing",
          "Maintained 80+ partner CRM with 55% retention improvement",
          "Administered CHF 1.2M annual budget cycle",
          "Reduced vendor process costs by 50% through process standardization",
        ],
        sort_order: 14,
      },

      // ---- Telecom 2009-2012 (3 lenses) ----
      {
        profile_id: profileId,
        stint_name: "Telecom 2009-2012",
        period: "2009-2012",
        organization: "Telecommunications (Sterlite Technologies / Ericsson)",
        lens_id: "telecom_engineering",
        title: "Core Network Engineer",
        tags: ["telecom", "network", "engineering", "operations", "SLA", "technical",
               "infrastructure", "IT", "MSC", "HLR"],
        summary: "Maintained near-100% uptime for core network infrastructure serving millions of subscribers, providing a strong technical foundation for subsequent policy work.",
        bullets: [
          "Ensured 24/7 quality for millions of subscribers under tight SLAs",
          "Achieved near-100% uptime for MSC, HLR, and IN systems",
          "Technical foundation enabling credibility in telecom policy and governance",
        ],
        sort_order: 15,
      },
      {
        profile_id: profileId,
        stint_name: "Telecom 2009-2012",
        period: "2009-2012",
        organization: "Telecommunications (Sterlite Technologies / Ericsson)",
        lens_id: "telecom_leadership",
        title: "Team Lead — Network Operations",
        tags: ["team management", "leadership", "cross-functional", "project management",
               "client", "problem solving", "escalation"],
        summary: "Led cross-functional teams serving Tier-1 telecom operators, managing escalations and vendor coordination for critical network incidents.",
        bullets: [
          "Led cross-functional teams for Tier-1 telecom operators",
          "Developed escalation workflows for critical network incidents",
          "Coordinated vendor relationships for network optimization",
        ],
        sort_order: 16,
      },
      {
        profile_id: profileId,
        stint_name: "Telecom 2009-2012",
        period: "2009-2012",
        organization: "Telecommunications (Sterlite Technologies / Ericsson)",
        lens_id: "telecom_sales",
        title: "Pre/Post Sales Technical Consultant",
        tags: ["sales", "B2B", "pre-sales", "client", "account management", "solution",
               "consulting", "technical", "upsell"],
        summary: "Delivered presales architecture and proposals for multi-million dollar telecom accounts, with post-sales SLA compliance and technical upselling.",
        bullets: [
          "Delivered presales architecture and solution proposals",
          "Ensured post-sales SLA compliance for multi-million dollar accounts",
          "Leveraged technical credibility to enable successful upsells",
        ],
        sort_order: 17,
      },
    ];

    // Delete existing lenses and re-insert (clean seed)
    await supabase.from("role_lenses").delete().eq("profile_id", profileId);
    const { error: lensError } = await supabase.from("role_lenses").insert(lenses);
    if (lensError) throw new Error(`Lenses error: ${lensError.message}`);

    return NextResponse.json({
      success: true,
      message: "Seeded successfully!",
      profile: { id: profileId, name: "Rahul Jha" },
      lensCount: lenses.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[seed] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
