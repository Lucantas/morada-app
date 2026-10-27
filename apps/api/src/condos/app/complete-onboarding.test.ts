import { completeOnboarding } from './complete-onboarding';

describe('completeOnboarding', () => {
  test('completes the onboarding of the given condominium', async () => {
    const completed: string[] = [];

    await completeOnboarding({ completeOnboarding: async (id) => void completed.push(id) }, 'c-1');

    expect(completed).toEqual(['c-1']);
  });
});
