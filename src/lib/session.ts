import apiClient from '../api/client';

type AgentMeResponse = {
  id: string;
  identity: string;
  current_income: number;
  working_hours: number;
  current_tick: number;
  interest_tags: string[];
  user: {
    id?: string;
    avatar?: string;
    nickname?: string;
  };
};

let inFlight: Promise<boolean> | null = null;

export async function hydrateSession(userStore: {
  user: any;
  setProfile: (u: any, a: any) => void;
  clearSession: () => void;
}) {
  if (userStore.user) return true;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { data } = await apiClient.post<AgentMeResponse>('/agent/me');
      userStore.setProfile(
        {
          id: data.user?.id,
          name: data.user?.nickname,
          metadata: { avatar: data.user?.avatar },
        },
        {
          id: data.id,
          identity: data.identity,
          currentIncome: Number(data.current_income ?? 0),
          workingHours: Number(data.working_hours ?? 0),
          currentTick: Number(data.current_tick ?? 0),
          interestTags: Array.isArray(data.interest_tags) ? data.interest_tags : [],
        },
      );
      return true;
    } catch {
      userStore.clearSession();
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
