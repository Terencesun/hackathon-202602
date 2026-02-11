import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getRank, type RankUser } from '../api/client';

export const useWorldRankStore = defineStore('worldRank', () => {
  const rankList = ref<RankUser[]>([]);
  const myRank = ref<number | undefined>(undefined);
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  async function fetchRank() {
    try {
      const data = await getRank(5);
      rankList.value = data.list;
      myRank.value = data.myRank;
    } catch (e) {
      console.error('Failed to fetch rank', e);
    }
  }

  function startPolling() {
    if (pollInterval) return;
    fetchRank(); // Initial fetch
    pollInterval = setInterval(fetchRank, 20000);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  return { rankList, myRank, fetchRank, startPolling, stopPolling };
});
