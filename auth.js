const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const SESSION_KEY = "blog.auth.session";
const ID_PATTERN = /^[\p{L}\p{N}._-]{2,30}$/u;
const ID_EMAIL_DOMAIN = "blog.local";

function normalizeId(value) {
  return value.trim().toLowerCase();
}

function toBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function idToEmail(id) {
  return `id.${toBase64Url(normalizeId(id))}@${ID_EMAIL_DOMAIN}`;
}

function getErrorMessage(payload, fallback) {
  return payload?.error_description || payload?.msg || payload?.message || payload?.error || fallback;
}

async function requestAuth(path, body) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "요청을 처리하지 못했습니다."));
  }

  return payload;
}

function saveSession(payload, id) {
  const session = payload?.session || payload;
  if (!session?.access_token) return false;

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: payload.user || session.user,
      id,
    })
  );

  return true;
}

function setMessage(form, text, type = "info") {
  const message = form.querySelector("[data-auth-message]");
  message.textContent = text;
  message.dataset.type = type;
}

function setBusy(form, busy) {
  const button = form.querySelector("button[type='submit']");
  button.disabled = busy;
  button.textContent = busy ? "처리 중" : button.dataset.label;
}

function validateCredentials(id, password, mode) {
  if (!ID_PATTERN.test(id)) {
    throw new Error("아이디는 2~30자의 문자, 숫자, ., _, -만 사용할 수 있습니다.");
  }

  if (password.length < 6) {
    throw new Error("비밀번호는 6자 이상 입력해주세요.");
  }

  if (mode === "signup") {
    const confirmPassword = document.querySelector("#confirm-password")?.value || "";
    if (password !== confirmPassword) {
      throw new Error("비밀번호가 서로 다릅니다.");
    }
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const mode = form.dataset.mode;
  const id = normalizeId(form.querySelector("#user-id").value);
  const password = form.querySelector("#password").value;

  try {
    setBusy(form, true);
    validateCredentials(id, password, mode);

    const email = idToEmail(id);
    const payload =
      mode === "signup"
        ? await requestAuth("signup", {
            email,
            password,
            data: {
              username: id,
              login_id: id,
            },
          })
        : await requestAuth("token?grant_type=password", {
            email,
            password,
          });

    const hasSession = saveSession(payload, id);

    if (mode === "signup" && !hasSession) {
      setMessage(
        form,
        "회원가입 요청이 완료되었습니다. 이메일 확인 설정이 켜져 있으면 Supabase Auth 설정에서 확인을 꺼야 바로 로그인할 수 있습니다.",
        "success"
      );
      return;
    }

    setMessage(form, mode === "signup" ? "회원가입이 완료되었습니다." : "로그인되었습니다.", "success");
    window.setTimeout(() => {
      window.location.href = "./";
    }, 800);
  } catch (error) {
    setMessage(form, error.message, "error");
  } finally {
    setBusy(form, false);
  }
}

document.querySelectorAll("[data-auth-form]").forEach((form) => {
  const button = form.querySelector("button[type='submit']");
  button.dataset.label = button.textContent;
  form.addEventListener("submit", handleSubmit);
});
