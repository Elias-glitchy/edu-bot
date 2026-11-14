import test from 'node:test';
import assert from 'node:assert/strict';
import { educationRoles, missionTemplates, roleAllowsTool, validateTemplate } from '../apps/api/education-registry.mjs';

test('education registry exposes exactly CHIEF plus ten protected specialists with deny-by-default tools',()=>{
  assert.equal(educationRoles.length,11);assert.equal(educationRoles[0].slug,'chief');assert.equal(new Set(educationRoles.map(role=>role.roleKey)).size,11);
  assert.equal(roleAllowsTool('assessment_grading','draft_criterion_scores'),true);
  assert.equal(roleAllowsTool('assessment_grading','execute_approved_sheet_update'),false);
  assert.equal(missionTemplates.length,5);for(const template of missionTemplates)assert.equal(validateTemplate(template),true);
  assert.throws(()=>validateTemplate({id:'cycle',steps:[{id:'a',roleKey:'academic_operations',tool:'list_assignment_status',dependsOn:['b']},{id:'b',roleKey:'academic_operations',tool:'list_assignment_status',dependsOn:['a']}]}),/cycle/i);
});
