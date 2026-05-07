"""
Role-based prompt prefixes and NLI hypotheses for role-specific summarization.

Each role has:
  - prompt: Prepended to text before abstractive summarization (tells BART HOW to write)
  - hypotheses: Used by zero-shot NLI to filter sentences (tells classifier WHAT to keep)
"""

ROLES: dict[str, dict] = {
    "GENERAL": {
        "prompt": "",
        "hypotheses": [],  # no filtering for general
    },
    "EXECUTIVE": {
        "prompt": (
            "Summarize for a business executive. "
            "Focus on strategic decisions, financial impact, ROI, risks, "
            "and actionable recommendations. Be concise and results-oriented:\n\n"
        ),
        "hypotheses": [
            "This text discusses strategic business decisions or outcomes",
            "This text describes financial impact, revenue, or costs",
            "This text mentions stakeholder outcomes or organizational strategy",
        ],
    },
    "TECHNICAL": {
        "prompt": (
            "Summarize for a technical audience. "
            "Emphasize system architecture, algorithms, implementation details, "
            "APIs, data structures, performance metrics, and trade-offs:\n\n"
        ),
        "hypotheses": [
            "This text discusses technical implementation or system architecture",
            "This text describes algorithms, data structures, or code",
            "This text mentions API design, performance, or technical trade-offs",
        ],
    },
    "STUDENT": {
        "prompt": (
            "Summarize as study notes for a student. "
            "Highlight key definitions, core concepts, important examples, "
            "cause-and-effect relationships, and potential exam topics:\n\n"
        ),
        "hypotheses": [
            "This text defines a concept or provides an educational explanation",
            "This text describes a theory, principle, or fundamental idea",
            "This text gives an example or illustrates a concept",
        ],
    },
    "RESEARCHER": {
        "prompt": (
            "Summarize for an academic researcher. "
            "Focus on methodology, experimental design, key findings, "
            "statistical significance, limitations, and future research directions:\n\n"
        ),
        "hypotheses": [
            "This text discusses research methodology or experimental design",
            "This text presents findings, results, or statistical analysis",
            "This text mentions literature gaps, limitations, or future work",
        ],
    },
    "LEGAL": {
        "prompt": (
            "Summarize for a legal professional. "
            "Focus on obligations, rights, liabilities, regulatory requirements, "
            "contractual terms, compliance issues, and legal precedents:\n\n"
        ),
        "hypotheses": [
            "This text discusses legal obligations, rights, or compliance",
            "This text describes contractual terms, regulations, or liabilities",
            "This text mentions jurisdiction, precedent, or legal procedure",
        ],
    },
    "CREATIVE": {
        "prompt": (
            "Summarize from a literary/creative writing perspective. "
            "Focus on narrative structure, character development, themes, "
            "symbolism, literary devices, tone, and stylistic choices:\n\n"
        ),
        "hypotheses": [
            "This text discusses narrative elements or storytelling",
            "This text describes characters, themes, or literary devices",
            "This text mentions creative style, tone, or artistic expression",
        ],
    },
    "MEDICAL": {
        "prompt": (
            "Summarize for a medical or healthcare professional. "
            "Focus on clinical findings, diagnoses, treatment protocols, "
            "drug interactions, patient outcomes, and evidence-based guidelines:\n\n"
        ),
        "hypotheses": [
            "This text discusses clinical diagnosis or treatment",
            "This text describes medical procedures, drugs, or patient care",
            "This text mentions health outcomes, symptoms, or medical evidence",
        ],
    },
    "ANALYST": {
        "prompt": (
            "Summarize for a data or business analyst. "
            "Focus on quantitative data, trends, KPIs, patterns, "
            "correlations, forecasts, and data-driven insights:\n\n"
        ),
        "hypotheses": [
            "This text discusses data analysis, trends, or metrics",
            "This text describes quantitative patterns or statistical insights",
            "This text mentions KPIs, forecasts, or data-driven decisions",
        ],
    },
    "EDUCATOR": {
        "prompt": (
            "Summarize for an educator or curriculum designer. "
            "Focus on learning objectives, pedagogical approaches, "
            "assessment strategies, skill development, and educational outcomes:\n\n"
        ),
        "hypotheses": [
            "This text discusses teaching methods or pedagogy",
            "This text describes curriculum design or learning objectives",
            "This text mentions student assessment or educational outcomes",
        ],
    },
}


def get_role_prompt(role: str) -> str:
    """Return the prompt prefix for a given role."""
    role_data = ROLES.get(role.upper(), ROLES["GENERAL"])
    return role_data["prompt"]


def get_role_hypotheses(role: str) -> list[str]:
    """Return the NLI hypotheses for a given role."""
    role_data = ROLES.get(role.upper(), ROLES["GENERAL"])
    return role_data["hypotheses"]
