<script setup lang="ts">
import smLogoUrl from '../assets/sm.svg?url';

const handleLogin = () => {
  const clientId = import.meta.env.VITE_SECONDME_CLIENT_ID || 'mock_client_id';
  const redirectUri =
    import.meta.env.VITE_SECONDME_REDIRECT_URI ||
    window.location.origin + '/auth/callback';
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem('oauth_state', state);
  const authUrl = `https://go.second.me/oauth/?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&state=${encodeURIComponent(state)}`;

  window.location.href = authUrl;
};
</script>

<template>
  <div class="login-shell min-h-screen grid grid-cols-1 place-content-center justify-items-center p-6 gap-8">
    <header class="w-full max-w-2xl text-center">
      <div class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full title-pill">
        <img
          class="pill-logo"
          :src="smLogoUrl"
          alt="SecondMe"
        >
      </div>
      <h1 class="mt-5 title-text">
        工厂打工历险记
      </h1>
      <p class="mt-3 subtitle-text">
        用 SecondMe 账号开启你的打工冒险
      </p>
    </header>

    <main class="w-full max-w-md">
      <div class="login-card">
        <button
          class="login-btn"
          type="button"
          @click="handleLogin"
        >
          <span
            class="btn-icon"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              class="btn-icon-svg"
              fill="none"
            >
              <path
                d="M7 8.5V7.2C7 6.54 7.54 6 8.2 6h7.6c.66 0 1.2.54 1.2 1.2v1.3"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
              <path
                d="M6.6 9.2h10.8c.88 0 1.6.72 1.6 1.6v6.6c0 .88-.72 1.6-1.6 1.6H6.6c-.88 0-1.6-.72-1.6-1.6v-6.6c0-.88.72-1.6 1.6-1.6Z"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
              <path
                d="M9 14.2h6"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
          </span>
          <span class="btn-text">使用 SecondMe 登录</span>
          <span
            class="btn-arrow"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              class="btn-arrow-svg"
              fill="none"
            >
              <path
                d="M10 7l5 5-5 5"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
        </button>

        <div class="mt-6 text-center fineprint">
          <a
            class="fineprint-link"
            href="https://home.second.me/"
            target="_blank"
            rel="noopener noreferrer"
          >
            登录即表示你同意 SecondMe 账号服务条款
          </a>
        </div>
      </div>

      <footer class="mt-8 text-center footer-text">
        SecondMe Hackathon@2026 🏭⚙️✨
      </footer>
    </main>
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

.title-pill {
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(146, 64, 14, 0.16);
  backdrop-filter: blur(10px);
  box-shadow:
    0 18px 40px rgba(146, 64, 14, 0.10),
    0 6px 16px rgba(255, 187, 157, 0.18);
}

.pill-logo {
  height: 18px;
  width: auto;
  display: block;
}

.title-text {
  font-weight: 400;
  letter-spacing: 0.04em;
  font-size: clamp(36px, 4.4vw, 56px);
  line-height: 1.05;
  color: rgba(120, 53, 15, 0.95);
  text-shadow:
    0 18px 42px rgba(255, 187, 157, 0.35),
    0 6px 18px rgba(146, 64, 14, 0.10);
}

.subtitle-text {
  font-weight: 400;
  font-size: 16px;
  color: rgba(99, 110, 114, 0.95);
}

.login-card {
  position: relative;
  border-radius: 18px;
  padding: 22px 22px 20px;
  background: rgba(255, 255, 255, 0.72);
  border: 3px solid rgba(0, 0, 0, 0.9);
  box-shadow:
    10px 10px 0 rgba(0, 0, 0, 0.9),
    0 24px 60px rgba(146, 64, 14, 0.14);
  backdrop-filter: blur(14px);
}

.login-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 14px;
  border-radius: 14px;
  border: 3px solid rgba(0, 0, 0, 0.92);
  background: rgba(146, 64, 14, 0.92);
  color: #fff;
  box-shadow:
    6px 6px 0 rgba(0, 0, 0, 0.92),
    0 18px 40px rgba(146, 64, 14, 0.20);
  transition: transform 120ms ease, box-shadow 120ms ease, background-color 160ms ease;
  cursor: pointer;
}

.login-btn:hover {
  transform: translate(2px, 2px);
  box-shadow:
    4px 4px 0 rgba(0, 0, 0, 0.92),
    0 14px 32px rgba(146, 64, 14, 0.18);
  background: rgba(180, 83, 9, 0.96);
}

.login-btn:active {
  transform: translate(4px, 4px);
  box-shadow:
    2px 2px 0 rgba(0, 0, 0, 0.92),
    0 10px 26px rgba(146, 64, 14, 0.16);
}

.btn-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
}

.btn-icon-svg {
  width: 20px;
  height: 20px;
}

.btn-text {
  flex: 1;
  text-align: left;
  font-weight: 600;
  font-size: 16px;
  letter-spacing: 0.01em;
}

.btn-arrow-svg {
  width: 18px;
  height: 18px;
  opacity: 0.92;
}

.fineprint {
  font-size: 12px;
  color: rgba(99, 110, 114, 0.92);
}

.fineprint-link {
  color: rgba(120, 53, 15, 0.95);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.footer-text {
  font-size: 12px;
  color: rgba(99, 110, 114, 0.9);
}

@media (prefers-reduced-motion: reduce) {
  .login-btn {
    transition: none;
  }
  .login-shell::before {
    animation: none;
  }
}
</style>
