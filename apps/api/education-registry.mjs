export const EDUCATION_SCHEMA_VERSION='1.0.0';

export const educationRoles=Object.freeze([
  {roleKey:'chief',slug:'chief',name:'CHIEF',role:'Executive Orchestrator',accent:'#3478ED',avatarId:null,capabilities:['mission_interpretation','plan_validation','capability_routing','progress_monitoring','approval_escalation','verified_completion'],tools:['create_plan','list_capabilities','create_task','assign_task','await_result','request_review','raise_approval','finish_mission']},
  {roleKey:'academic_operations',slug:'academic-operations',name:'Academic Operations Manager',role:'Schedules, submissions and academic workflow coordination',accent:'#15B9E8',avatarId:null,capabilities:['academic_schedules','submission_tracking','operational_coordination'],tools:['read_academic_schedule','propose_schedule','list_assignment_status','create_internal_task']},
  {roleKey:'student_records',slug:'student-records',name:'Student Records Manager',role:'Roster matching and governed draft gradebook records',accent:'#19AD68',avatarId:null,capabilities:['student_roster','identity_matching','draft_gradebook_records'],tools:['read_student_roster','match_students_by_id','detect_duplicate_records','preview_gradebook_update','submit_gradebook_for_approval']},
  {roleKey:'curriculum_lesson_planning',slug:'curriculum-lesson-planning',name:'Curriculum & Lesson Planning Manager',role:'Curriculum outcomes, lessons and teaching materials',accent:'#9251DE',avatarId:null,capabilities:['curriculum_outcomes','lesson_planning','teaching_materials'],tools:['extract_curriculum_outcomes','draft_lesson_plan','validate_outcome_coverage','create_teaching_resource']},
  {roleKey:'student_communications',slug:'student-communications',name:'Student Communications Manager',role:'Draft notices, reminders and approved correspondence',accent:'#D84850',avatarId:null,capabilities:['student_notices','lecturer_messages','reminders'],tools:['draft_student_notice','draft_lecturer_message','preview_recipient_list']},
  {roleKey:'academic_research',slug:'academic-research',name:'Academic Research Manager',role:'Source-backed education research and learning resources',accent:'#D8A939',avatarId:null,capabilities:['academic_research','source_verification','learning_resources'],tools:['public_search','open_public_page','summarize_sources','create_reference_list']},
  {roleKey:'student_support_tutoring',slug:'student-support-tutoring',name:'Student Support & Tutoring Manager',role:'Study guidance, revision and concept explanations',accent:'#E77B2B',avatarId:null,capabilities:['study_guidance','revision_materials','concept_explanations'],tools:['draft_study_plan','generate_practice_questions','explain_concept','generate_revision_notes']},
  {roleKey:'academic_reporting_analytics',slug:'academic-reporting-analytics',name:'Academic Reporting & Analytics Manager',role:'Class statistics, performance summaries and reports',accent:'#E952A5',avatarId:null,capabilities:['class_statistics','performance_summaries','academic_reports'],tools:['aggregate_class_scores','calculate_distribution','generate_report','export_csv','export_pdf_or_html']},
  {roleKey:'technology_integrations',slug:'technology-integrations',name:'Technology & Integrations Manager',role:'Document and spreadsheet integrations with diagnostics',accent:'#10AEB1',avatarId:null,capabilities:['google_sheets','document_integrations','tool_reliability'],tools:['list_available_connectors','test_google_sheets_connection','read_sheet','propose_sheet_update','execute_approved_sheet_update','verify_sheet_rows']},
  {roleKey:'assessment_grading',slug:'assessment-grading',name:'Assessment & Grading Manager',role:'Rubric-based draft assessment and criterion feedback',accent:'#929BA9',avatarId:null,capabilities:['rubric_based_draft_assessment','criterion_feedback','score_proposals'],tools:['extract_submission','parse_rubric','draft_criterion_scores','draft_student_feedback','save_draft_assessment','correct_assessment_totals']},
  {roleKey:'academic_quality_assurance',slug:'academic-quality-assurance',name:'Academic Quality Assurance Manager',role:'Independent validation, discrepancies and corrections',accent:'#94C926',avatarId:null,capabilities:['independent_checks','discrepancy_detection','correction_requests'],tools:['validate_rubric_bounds','recalculate_totals','validate_student_ids','check_missing_feedback','compare_artifact_to_source','request_correction','verify_revision']}
]);

export const legacyRoleSlugs=Object.freeze(['operations-manager','finance-manager','sales-manager','outbound-manager','intelligence-manager','crm-manager','marketing-manager','technology-manager','tender-bid-manager','estimating-commercial-manager']);

const roleMap=new Map(educationRoles.map(role=>[role.roleKey,role]));
export const roleDefinition=roleKey=>roleMap.get(roleKey)||null;
export const roleAllowsTool=(roleKey,tool)=>Boolean(roleMap.get(roleKey)?.tools.includes(tool));

export const missionTemplates=Object.freeze([
  {id:'assignment_assessment',name:'Assignment Assessment & Quality Review',description:'Create draft rubric scores, independently verify them, prepare a protected gradebook update and generate a class report.',requiredInputs:['assignment_files','rubric_file','demo_student_roster'],steps:[
    {id:'check_roster',roleKey:'academic_operations',tool:'list_assignment_status',dependsOn:[]},
    {id:'assess',roleKey:'assessment_grading',tool:'draft_criterion_scores',dependsOn:['check_roster']},
    {id:'qa_check',roleKey:'academic_quality_assurance',tool:'recalculate_totals',dependsOn:['assess']},
    {id:'correct',roleKey:'assessment_grading',tool:'correct_assessment_totals',dependsOn:['qa_check']},
    {id:'qa_verify',roleKey:'academic_quality_assurance',tool:'verify_revision',dependsOn:['correct']},
    {id:'prepare_gradebook',roleKey:'student_records',tool:'preview_gradebook_update',dependsOn:['qa_verify']},
    {id:'report',roleKey:'academic_reporting_analytics',tool:'generate_report',dependsOn:['qa_verify']},
    {id:'write_gradebook',roleKey:'technology_integrations',tool:'execute_approved_sheet_update',dependsOn:['prepare_gradebook'],requiresApproval:true},
    {id:'verify_gradebook',roleKey:'technology_integrations',tool:'verify_sheet_rows',dependsOn:['write_gradebook']}
  ]},
  {id:'class_performance_report',name:'Class Performance Report',description:'Validate verified draft results and create a provenance-linked class report.',requiredInputs:['verified_draft_results'],steps:[
    {id:'validate_records',roleKey:'student_records',tool:'detect_duplicate_records',dependsOn:[]},
    {id:'report',roleKey:'academic_reporting_analytics',tool:'generate_report',dependsOn:['validate_records']},
    {id:'review_report',roleKey:'academic_quality_assurance',tool:'compare_artifact_to_source',dependsOn:['report']}
  ]},
  {id:'lesson_preparation',name:'Lesson Preparation',description:'Turn curriculum material into a reviewed lesson plan.',requiredInputs:['curriculum_document','teaching_level','lesson_duration'],steps:[
    {id:'plan',roleKey:'curriculum_lesson_planning',tool:'draft_lesson_plan',dependsOn:[]},
    {id:'resources',roleKey:'academic_research',tool:'create_reference_list',dependsOn:[]},
    {id:'coverage',roleKey:'curriculum_lesson_planning',tool:'validate_outcome_coverage',dependsOn:['plan','resources']},
    {id:'review',roleKey:'academic_quality_assurance',tool:'compare_artifact_to_source',dependsOn:['coverage']}
  ]},
  {id:'student_support',name:'Student Support Plan',description:'Create a fictional learner support plan with revision materials and review.',requiredInputs:['fictional_student_learning_needs','course_outcomes'],steps:[
    {id:'support',roleKey:'student_support_tutoring',tool:'draft_study_plan',dependsOn:[]},
    {id:'references',roleKey:'academic_research',tool:'create_reference_list',dependsOn:[]},
    {id:'review',roleKey:'academic_quality_assurance',tool:'compare_artifact_to_source',dependsOn:['support','references']}
  ]},
  {id:'academic_administration',name:'Academic Administration',description:'Inspect submission status and create a draft notice without sending it.',requiredInputs:['fictional_student_roster','assignment_deadline','submission_status'],steps:[
    {id:'status',roleKey:'academic_operations',tool:'list_assignment_status',dependsOn:[]},
    {id:'records',roleKey:'student_records',tool:'read_student_roster',dependsOn:['status']},
    {id:'draft_notice',roleKey:'student_communications',tool:'draft_student_notice',dependsOn:['records']}
  ]}
]);

export function validateTemplate(template) {
  const ids=new Set(template.steps.map(step=>step.id));
  if(ids.size!==template.steps.length) throw new Error(`Template ${template.id} contains duplicate task IDs.`);
  for(const step of template.steps) {
    const role=roleDefinition(step.roleKey);
    if(!role||!roleAllowsTool(step.roleKey,step.tool)) throw new Error(`Template ${template.id} assigns ${step.tool} outside ${step.roleKey}.`);
    if(step.dependsOn.some(dep=>!ids.has(dep)||dep===step.id)) throw new Error(`Template ${template.id} contains an invalid dependency.`);
  }
  const visiting=new Set(),visited=new Set(),byId=new Map(template.steps.map(step=>[step.id,step]));
  function visit(id) {
    if(visiting.has(id)) throw new Error(`Template ${template.id} contains a dependency cycle.`);
    if(visited.has(id)) return;
    visiting.add(id);for(const dep of byId.get(id).dependsOn)visit(dep);visiting.delete(id);visited.add(id);
  }
  for(const id of ids)visit(id);
  return true;
}

for(const template of missionTemplates)validateTemplate(template);
export const missionTemplate=id=>missionTemplates.find(template=>template.id===id)||null;
