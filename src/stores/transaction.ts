import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getMeTransactions, type MeTransaction } from '../api/client';

export const useTransactionStore = defineStore('transaction', () => {
  const transactions = ref<MeTransaction[]>([]);
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  async function fetchTransactions() {
    try {
      transactions.value = await getMeTransactions();
    } catch (e) {
      console.error('Failed to fetch transactions', e);
    }
  }

  function startPolling() {
    if (pollInterval) return;
    fetchTransactions(); // Initial fetch
    pollInterval = setInterval(fetchTransactions, 5000);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  return { transactions, fetchTransactions, startPolling, stopPolling };
});
