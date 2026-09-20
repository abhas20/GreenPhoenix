from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from strands import Agent
from server.core.llm import get_model, get_fast_retry_strategy
from server.tools.document_tools import get_programs_requirements


class DocumentItem(BaseModel):
    document_name: str
    description: str
    required_for_programs: List[str]
    tips_for_applicant: str


class ExcludedProgram(BaseModel):
    program_id: str
    reason: str


class ApplicationDraft(BaseModel):
    selected_programs: List[str]
    consolidated_checklist: List[DocumentItem]
    sample_hardship_statement: str
    next_steps: List[str]
    excluded_programs: List[ExcludedProgram] = Field(
        default_factory=list,
        description="Programs that were requested but could not be drafted, with a reason (blocked/closed/lookup failed).",
    )


DOCUMENT_SYSTEM_PROMPT = """
You are the Global Application Documentation Specialist for the Community Aid Navigator.

Your objective:
1. Retrieve required proof documents for ALL selected programs at once using `get_programs_requirements`.
2. If a program's lookup fails (found=False) or applications_open is False, do NOT include that program in the checklist or
   hardship statement -- list it in `excluded_programs` with a short reason instead.
3. Group duplicate or common documents together into a single consolidated checklist.
   - For Indian schemes, common proofs include: Aadhaar Card, Ration Card, PAN Card, Income Certificate, BPL Card, Bank Passbook, Disability UDID card, Land Records (Khata/Khasra), MGNREGA Job Card.
   - For US/Global schemes, common proofs include: Government Photo ID (Driver's License, Passport, IDNYC), Proof of Income (Paystubs, Tax Returns, W-2), Tenancy/Lease agreement, Utility bill.
4. Provide practical, empathetic tips for how an applicant in crisis can obtain or present these documents (e.g. e-Aadhaar download, SSA myAccount, DigiLocker).
5. Draft a clear, polite personal hardship statement that reflects the applicant's actual situation and country context.
6. In `selected_programs`, strictly use the exact Program IDs or official Program Names returned by `get_programs_requirements`.
7. After tool calls finish, your final response MUST invoke the `ApplicationDraft` structured output model.
"""


def create_document_agent() -> Agent:
    model = get_model()
    return Agent(
        name="DocumentAgent",
        system_prompt=DOCUMENT_SYSTEM_PROMPT,
        tools=[get_programs_requirements],
        model=model,
        retry_strategy=get_fast_retry_strategy(max_attempts=2),
    )


def generate_application_pack(
    program_ids: List[str],
    applicant_summary: str = "",
    eligibility_by_program: Optional[Dict[str, Any]] = None,
    agent: Optional[Agent] = None,
) -> ApplicationDraft:
    """
    Retrieves requirements for selected programs and compiles a consolidated checklist and draft statement.
    """
    eligibility_by_program = eligibility_by_program or {}

    allowed_ids: List[str] = []
    pre_excluded: List[ExcludedProgram] = []
    for pid in program_ids:
        elig = eligibility_by_program.get(pid)
        if elig is not None and elig.get("eligible") is False:
            pre_excluded.append(ExcludedProgram(program_id=pid, reason="Applicant does not meet this program's eligibility requirements."))
            continue
        allowed_ids.append(pid)

    if not allowed_ids:
        return ApplicationDraft(
            selected_programs=[],
            consolidated_checklist=[],
            sample_hardship_statement="",
            next_steps=["None of the requested programs could be drafted -- see excluded_programs for reasons."],
            excluded_programs=pre_excluded,
        )

    doc_agent = agent or create_document_agent()

    if doc_agent.model:
        try:
            prompt = (
                f"Create a personalized application documentation package for these aid programs:\n"
                f"Program IDs: {allowed_ids}\n"
                f"Applicant Context/Summary: {applicant_summary}\n\n"
                f"Instructions:\n"
                f"1. Call `get_programs_requirements` ONCE passing the entire list of Program IDs.\n"
                f"2. If a lookup returns found=False or applications_open is False, exclude it and note it in excluded_programs.\n"
                f"3. Consolidate overlapping documents into a clean checklist with practical, compassionate tips.\n"
                f"4. Compose an empathetic hardship statement tailored specifically to this applicant's situation.\n"
                f"5. Return the ApplicationDraft structured output tool."
            )
            result = doc_agent(prompt, structured_output_model=ApplicationDraft)

            if isinstance(result.structured_output, ApplicationDraft) and result.structured_output.consolidated_checklist:
                draft = result.structured_output

                reqs_batch = get_programs_requirements(program_ids=allowed_ids)
                known_names = {pid: reqs_batch.get(pid, {}).get("name", pid) for pid in allowed_ids}

                covered = set(draft.selected_programs)
                missing = [pid for pid in allowed_ids if pid not in covered and known_names.get(pid) not in covered]

                if missing:
                    print(f"[DocumentAgent] LLM omitted programs without flagging them: {missing}. Falling back to deterministic template.")
                else:
                    draft.excluded_programs = pre_excluded + draft.excluded_programs
                    return draft
        except Exception as e:
            print(f"[DocumentAgent] LLM fallback to deterministic template due to: {e}")

    fallback = _deterministic_generate_application_pack(allowed_ids, applicant_summary)
    fallback.excluded_programs = pre_excluded + fallback.excluded_programs
    return fallback


def _deterministic_generate_application_pack(
    program_ids: List[str],
    applicant_summary: str = "",
) -> ApplicationDraft:
    docs_map: Dict[str, List[str]] = {}
    program_names: List[str] = []
    excluded: List[ExcludedProgram] = []

    requirements_batch = get_programs_requirements(program_ids=program_ids)

    for pid in program_ids:
        req = requirements_batch.get(pid, {})

        if not req.get("found", False):
            excluded.append(ExcludedProgram(program_id=pid, reason=req.get("error", "Could not retrieve program requirements.")))
            continue
        if req.get("applications_open") is False:
            excluded.append(ExcludedProgram(program_id=pid, reason="Applications are currently closed for this program."))
            continue

        pname = req.get("name", pid)
        program_names.append(pname)
        for d in req.get("required_documents", []):
            docs_map.setdefault(d, []).append(pname)

    checklist: List[DocumentItem] = []
    tips_catalog = {
        # Indian documents
        "aadhaar": "Aadhaar card copy, e-Aadhaar from uidai.gov.in, or DigiLocker certified copy.",
        "ration card": "State Food & Civil Supplies Ration Card (AAY, PHH, or BPL) or digital ration card.",
        "income certificate": "Income certificate issued by local Tehsildar, Revenue Officer, or employer pay slip.",
        "bank passbook": "First page of bank/post office passbook showing account number, name, and IFSC code.",
        "job card": "Active MGNREGA Job Card issued by local Gram Panchayat.",
        "land records": "Land ownership document (RoR / Khata / Khasra) from state land revenue portal (Bhulekh).",
        "vendor id": "Certificate of Vending or Identity Card issued by Urban Local Body (ULB) / Town Vending Committee.",
        "disability certificate": "Unique Disability ID (UDID) card or Medical Board disability certificate (40%+).",
        "bpl certificate": "BPL ration card or certificate issued by local panchayat / municipal ward.",
        # US & Global documents
        "photo id": "Driver's license, State ID, NYC Municipal ID (IDNYC), or passport.",
        "proof of income": "Recent paystubs, W-2/1099 tax forms, or public benefits statement letter.",
        "proof of residence": "Copy of lease, rent receipt, or recent utility bill (gas/electric/water).",
        "disability benefit award letter": "Download or request from SSA (ssa.gov/myaccount) or VA benefits office.",
        "child's age verification": "Birth certificate, school enrollment record, or immunization card.",
        "national insurance": "National Insurance card, letter from DWP, or payslip.",
        "social insurance": "Social Insurance Number (SIN) confirmation letter or Canadian tax assessment.",
    }

    for doc_name, req_programs in docs_map.items():
        tip = "Original or clear digital photo/scan is usually accepted (DigiLocker or mobile photo)."
        for key, tip_text in tips_catalog.items():
            if key in doc_name.lower():
                tip = tip_text
                break

        checklist.append(DocumentItem(
            document_name=doc_name,
            description=f"Required verification for: {', '.join(req_programs)}",
            required_for_programs=req_programs,
            tips_for_applicant=tip,
        ))

    situation_clause = f" {applicant_summary.strip()}" if applicant_summary.strip() else " Due to financial and living hardship, my household requires critical public assistance and community benefits to maintain essential living security."

    statement = ""
    if program_names:
        statement = (
            f"I am writing to formally submit my application for {', '.join(program_names)}."
            f"{situation_clause} "
            f"I have assembled the attached verification documents and appreciate your prompt review."
        )

    next_steps = []
    if program_names:
        next_steps = [
            "Gather the documents listed in your checklist.",
            "Take clear photos or scans of each document with your phone or download from official portals (e.g. DigiLocker, ssa.gov).",
            "Submit applications online through the official portal links provided, or visit your local welfare center or Gram Panchayat.",
        ]
    if excluded:
        next_steps.append("Some requested programs could not be included -- see excluded_programs for details.")

    return ApplicationDraft(
        selected_programs=program_names,
        consolidated_checklist=checklist,
        sample_hardship_statement=statement,
        next_steps=next_steps or ["No programs could be drafted -- see excluded_programs for reasons."],
        excluded_programs=excluded,
    )
