import assert from 'node:assert/strict'
import {
  buildAdaptiveInterviewPrompt,
  loadSeedQuestionLibrary,
} from '../lib/interview-seeds'

const genericSeed = loadSeedQuestionLibrary('nonexistent_domain_for_test')
assert.equal(genericSeed.source, 'general_sme')
assert.match(genericSeed.content, /General SME Onboarding/i)
assert.doesNotMatch(genericSeed.content, /Patrick Chidsey/i)
assert.doesNotMatch(genericSeed.content, /CPT/i)

const prompt = buildAdaptiveInterviewPrompt({
  topic: 'lab equipment access',
  seedQuestions: genericSeed.content,
  smeProfile: {
    full_name: 'Morgan Lee',
    title: 'Prototyping Lab Manager',
    domain: 'prototyping_lab',
    topics: ['equipment_access', 'safety_training'],
    exclusions: ['academic_advising'],
  },
  interviewPlan: [
    'Walk through how someone gets access to lab equipment.',
    'Clarify what safety training is required before access.',
  ],
})

assert.match(prompt, /adapt/i)
assert.match(prompt, /Prototyping Lab Manager/)
assert.match(prompt, /equipment_access/)
assert.match(prompt, /lab equipment access/)
assert.match(prompt, /Do NOT ask the SME to pick a topic/)
assert.match(prompt, /Walk through how someone gets access/)

console.log('general SME interview plan checks passed')
