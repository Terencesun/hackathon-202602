<script setup lang="ts">
import { onMounted, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '../api/client';
import { useUserStore } from '../stores/user';
import { ElMessage } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';

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
    ElMessage({
      message: 'Loading...',
      icon: h(Loading, { style: 'animation: rotating 2s linear infinite' }),
      type: 'success',
    });
    router.push('/dashboard');
  } catch (error) {
    ElMessage.error('(>_<) 认证失败');
    router.push('/');
  }
});
</script>

<template>
  <div class="login-shell min-h-screen grid place-items-center p-6">
    <div class="callback-card text-center">
      <el-icon class="is-loading text-4xl mb-4 callback-icon">
        <Loading />
      </el-icon>
      <p class="callback-title">
        正在验证身份…
      </p>
      <p class="callback-subtitle mt-2">
        请稍候，马上进入冒险
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-shell {
  color: #2d3436;
  font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans SC", system-ui, -apple-system,
    Segoe UI, Roboto, Arial, sans-serif;
  background:
    radial-gradient(900px 520px at 18% 22%, rgba(255, 215, 164, 0.52), transparent 64%),
    radial-gradient(720px 480px at 84% 28%, rgba(255, 187, 157, 0.42), transparent 58%),
    radial-gradient(900px 700px at 52% 84%, rgba(255, 244, 224, 0.70), rgba(255, 251, 245, 0.92) 55%, rgba(255, 251, 245, 1) 100%),
    linear-gradient(135deg, #fff8f0 0%, #fffaf5 45%, #fffdfb 100%);
  position: relative;
  overflow: hidden;
}

.login-shell::before,
.login-shell::after {
  content: "";
  position: absolute;
  inset: -120px;
  pointer-events: none;
}

.login-shell::before {
  inset: -220px;
  opacity: 0.55;
  background:
    radial-gradient(220px 220px at 20% 25%, rgba(255, 180, 120, 0.38), transparent 68%),
    radial-gradient(280px 280px at 82% 22%, rgba(255, 160, 130, 0.30), transparent 70%),
    radial-gradient(320px 260px at 56% 78%, rgba(255, 220, 160, 0.26), transparent 70%);
  filter: blur(10px);
  transform: translate3d(0, 0, 0);
  animation: glowFloat 10s ease-in-out infinite alternate;
}

.login-shell::after {
  opacity: 0.85;
  background:
    repeating-linear-gradient(
      0deg,
      rgba(146, 64, 14, 0.035) 0px,
      rgba(146, 64, 14, 0.035) 1px,
      transparent 1px,
      transparent 18px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(146, 64, 14, 0.035) 0px,
      rgba(146, 64, 14, 0.035) 1px,
      transparent 1px,
      transparent 18px
    );
  mask-image: radial-gradient(closest-side at 50% 50%, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0));
  filter: blur(0.2px);
}

@keyframes glowFloat {
  0% {
    transform: translate3d(-10px, -8px, 0) scale(1);
  }
  50% {
    transform: translate3d(12px, -2px, 0) scale(1.03);
  }
  100% {
    transform: translate3d(4px, 10px, 0) scale(1.02);
  }
}

.callback-card {
  width: min(520px, 100%);
  border-radius: 18px;
  padding: 26px 22px;
  background: rgba(255, 255, 255, 0.72);
  border: 3px solid rgba(0, 0, 0, 0.9);
  box-shadow:
    10px 10px 0 rgba(0, 0, 0, 0.9),
    0 24px 60px rgba(146, 64, 14, 0.14);
  backdrop-filter: blur(14px);
}

.callback-icon {
  color: rgba(146, 64, 14, 0.92);
}

.callback-title {
  font-weight: 600;
  font-size: 16px;
  color: rgba(120, 53, 15, 0.95);
}

.callback-subtitle {
  font-size: 13px;
  color: rgba(99, 110, 114, 0.92);
}

@media (prefers-reduced-motion: reduce) {
  .login-shell::before {
    animation: none;
  }
}
</style>
