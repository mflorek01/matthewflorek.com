import { describe, expect, it } from 'vitest';
import { sanitizeAnalyticsEvent, sanitizeAnalyticsProperties } from '../src/lib/analytics/events';

describe('analytics event contract', () => {
  it('normalizes bounded categorical properties', () => {
    expect(sanitizeAnalyticsEvent({ name: 'tab_viewed', properties: { tab: 'Work Projects' } })).toEqual({
      name: 'tab_viewed',
      properties: { tab: 'work-projects' }
    });
  });

  it('does not permit unknown fields or free-form chat text', () => {
    expect(sanitizeAnalyticsProperties({ question: 'What did you build?' })).toBeUndefined();
    expect(sanitizeAnalyticsProperties({ source: 'a'.repeat(81) })).toBeUndefined();
  });

  it('keeps analytics event names typed and drops empty properties', () => {
    expect(sanitizeAnalyticsEvent({ name: 'ai_question_submitted' })).toEqual({ name: 'ai_question_submitted' });
    expect(sanitizeAnalyticsEvent({ name: 'not_an_event' })).toBeUndefined();
  });
});
