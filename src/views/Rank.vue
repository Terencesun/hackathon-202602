<script setup lang="ts">
import { ref, onMounted } from 'vue';
import apiClient from '../api/client';
import { Trophy } from 'lucide-vue-next';

const ranking = ref<any[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const { data } = await apiClient.get('/agents/rank');
    ranking.value = data.agents;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="min-h-screen bg-background text-text p-6">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center gap-4 mb-8">
        <Trophy class="w-8 h-8 text-yellow-500" />
        <h1 class="text-3xl font-bold font-mono">
          Global Wealth Ranking
        </h1>
      </div>

      <div class="bg-container rounded-lg border border-container-secondary overflow-hidden">
        <el-table
          v-loading="loading"
          :data="ranking"
          style="width: 100%"
          :row-class-name="'bg-container text-text'"
        >
          <el-table-column
            type="index"
            label="Rank"
            width="80"
            align="center"
          />
          <el-table-column
            prop="identity"
            label="Identity"
            width="120"
          >
            <template #default="{ row }">
              <span
                class="capitalize px-2 py-1 rounded text-xs font-bold"
                :class="{
                  'bg-factory/20 text-factory': row.identity === 'worker',
                  'bg-office/20 text-office': row.identity === 'broker',
                  'bg-dorm/20 text-dorm': row.identity === 'layflat'
                }"
              >{{ row.identity }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="currentIncome"
            label="Wealth"
            align="right"
          >
            <template #default="{ row }">
              <span class="font-mono text-primary">¥{{ Number(row.currentIncome).toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="workingHours"
            label="Hours"
            align="right"
            width="100"
          />
        </el-table>
      </div>
      
      <div class="mt-8 text-center">
        <router-link to="/dashboard">
          <el-button>Back to Dashboard</el-button>
        </router-link>
      </div>
    </div>
  </div>
</template>
