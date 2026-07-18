/**
 * 与 funnel.js enrich 逻辑对齐（Node 侧无 DOM）。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const STEPS = { DISCOVER: 1, BROWSE: 2, ENGAGE: 3, LEARN: 4, COMPLETE: 5 };
const STAGE_BY_STEP = {
  1: 'discover',
  2: 'browse',
  3: 'engage',
  4: 'learn',
  5: 'complete',
};
const EVENT_STEP = {
  funnel_entry: STEPS.DISCOVER,
  section_view: STEPS.BROWSE,
  search_query: STEPS.BROWSE,
  'course-click': STEPS.LEARN,
  recommend_query_tool: STEPS.ENGAGE,
  roadmap_phase_toggle: STEPS.COMPLETE,
};

function enrich(name, params = {}, journeyId = 'test-journey') {
  const step =
    typeof params.funnel_step === 'number'
      ? params.funnel_step
      : EVENT_STEP[name] || STEPS.DISCOVER;
  const stage = params.funnel_stage || STAGE_BY_STEP[step] || 'discover';
  return {
    ...params,
    journey_id: params.journey_id || journeyId,
    funnel_step: step,
    funnel_stage: stage,
    page_type: params.page_type || 'home',
  };
}

test('enrich adds journey_id and funnel_step for section_view', () => {
  const out = enrich('section_view', { section: 'section-courses' });
  assert.equal(out.journey_id, 'test-journey');
  assert.equal(out.funnel_step, 2);
  assert.equal(out.funnel_stage, 'browse');
  assert.equal(out.section, 'section-courses');
});

test('enrich respects explicit funnel_step override', () => {
  const out = enrich('custom', { funnel_step: 5 });
  assert.equal(out.funnel_step, 5);
  assert.equal(out.funnel_stage, 'complete');
});

test('course-click maps to learn stage', () => {
  const out = enrich('course-click', { course_title: 'ML 入门', course_track: '机器学习' });
  assert.equal(out.funnel_step, 4);
  assert.equal(out.funnel_stage, 'learn');
  assert.equal(out.course_title, 'ML 入门');
});

test('recommend_query_tool maps to engage stage', () => {
  const out = enrich('recommend_query_tool', { tool: 'chatgpt' });
  assert.equal(out.funnel_step, 3);
  assert.equal(out.funnel_stage, 'engage');
});
