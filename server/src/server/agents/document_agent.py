from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from strands import Agent
from server.core.llm import get_model
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
You are the Application Documentation Specialist for the Community Aid Navigator.

Your objective:
1. Retrieve required proof documents for ALL selected programs at once using `get_programs_requirements`.
2. If a program's lookup fails (found=False) or applications_open is False, do NOT include that program in the checklist or
   hardship statement -- list it in `excluded_programs` with a short reason instead.
3. Group duplicate or common documents together (e.g. Photo ID, Proof of Income/Lease) into a single consolidated checklist.
4. Provide practical, empathetic tips for how an applicant in crisis can obtain or present these documents.
5. Draft a clear, polite personal hardship statement that reflects the applicant's actual situation.
6. `selected_programs` must reflect the programs you were actually able to draft for.
"""

def create_document_agent() -> Agent:
    model = get_model()
    return Agent(
        name="DocumentAgent",
        system_prompt=DOCUMENT_SYSTEM_PROMPT,
        tools=[get_programs_requirements],  # Provide the new plural tool
        model=model,
    )

def generate_application_pack(
    program_ids: List[str],
    applicant_summary: str = "",
    eligibility_by_program: Optional[Dict[str, Any]] = None,
    agent: Optional[Agent] = None,
) -> ApplicationDraft:
    """
    Retrieves requirements for selected programs and compiles a consolidated checklist and draft statement.

    Args:
        program_ids: Programs the applicant wants to apply to.
        applicant_summary: Free-text summary of the applicant's situation, used to personalize
            the hardship statement (also used in the deterministic fallback, not just the LLM path).
        eligibility_by_program: Optional dict of program_id -> check_program_eligibility() result.
            If provided, any program with eligible=False is excluded from drafting entirely.
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
                
                # Fetch batch requirements just to validate what the LLM did (fast because OpenSearch is quick)
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

    # Make exactly ONE call to the database instead of looping
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

    # ... (the rest of the checklist logic and tips_catalog remain exactly the same) ...
    checklist: List[DocumentItem] = []
    tips_catalog = {
        "photo id": "Driver's license, NYC Municipal ID (IDNYC), or passport.",
        "proof of income": "Recent paystubs, W-2 tax forms, or public benefits statement letter.",
        "proof of residence": "Copy of lease, rent receipt, or recent utility bill (gas/electric).",
        "disability benefit award letter": "Download or request from SSA (ssa.gov/myaccount) or VA benefits office.",
        "child's age verification": "Birth certificate, school enrollment record, or immunization card.",
    }

    for doc_name, req_programs in docs_map.items():
        tip = "Original or clear digital photo/scan is usually accepted."
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

    situation_clause = f" {applicant_summary.strip()}" if applicant_summary.strip() else " Due to unforeseen financial and housing hardship, my household requires critical community aid to maintain stable shelter, nutrition, and essential living expenses."
    
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
            "Take clear photos or scans of each document with your phone.",
            "Submit applications online through the provided official portal links, or contact your caseworker.",
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
