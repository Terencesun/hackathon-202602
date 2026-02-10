<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '../api/client';
import { useUserStore } from '../stores/user';
import { ElMessage } from 'element-plus';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

onMounted(async () => {
  const code = route.query.code as string;
  const oauthError = route.query.error as string | undefined;
  const oauthErrorDesc = route.query.error_description as string | undefined;
  if (oauthError) {
    ElMessage.error(decodeURIComponent(oauthErrorDesc || oauthError));
    router.push('/');
    return;
  }
  const returnedState = route.query.state as string | undefined;
  const expectedState = sessionStorage.getItem('oauth_state');
  if (!code) {
    ElMessage.error('No authorization code found');
    router.push('/');
    return;
  }
  if (!returnedState || !expectedState || returnedState !== expectedState) {
    ElMessage.error('State mismatch, potential CSRF detected');
    router.push('/');
    return;
  }
  sessionStorage.removeItem('oauth_state');

  try {
    const { data } = await apiClient.post('/auth/login', {
      code,
      redirectUri: window.location.origin + '/auth/callback'
    });

    userStore.setProfile(data.user, data.agent);
    ElMessage.success('Login successful');
    router.push('/dashboard');
  } catch (error) {
    ElMessage.error('登录失败');
    router.push('/');
  }
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background text-text">
    <div class="text-center">
      <el-icon class="is-loading text-4xl mb-4 text-primary">
        <Loading />
      </el-icon>
      <p>Authenticating...</p>
    </div>
  </div>
</template>
