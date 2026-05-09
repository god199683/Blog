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
  const message = payload?.error_description || payload?.msg || payload?.message || payload?.error || fallback;
  if (/invalid login credentials/i.test(message)) return "아이디 또는 비밀번호가 맞지 않습니다.";
  if (/already registered|already exists|user already/i.test(message)) return "이미 사용 중인 아이디입니다.";
  return message;
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
  if (!response.ok) throw new Error(getErrorMessage(payload, "요청을 처리하지 못했습니다."));
  return payload;
}

async function requestRest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: options.token ? `Bearer ${options.token}` : `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(getErrorMessage(payload, "힌트를 처리하지 못했습니다."));
  return payload;
}

function getSession(payload) {
  return payload?.session || payload;
}

function saveSession(payload, id) {
  const session = getSession(payload);
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

function normalizeHint(value = "") {
  return value.trim().replace(/\s+/g, " ").slice(0, 160);
}

function setMessage(form, text, type = "info") {
  const message = form.querySelector("[data-auth-message]");
  if (!message) return;
  message.textContent = text;
  message.dataset.type = type;
}

function setBusy(form, busy) {
  const button = form.querySelector("button[type='submit']");
  button.disabled = busy;
  button.textContent = busy ? "처리 중" : button.dataset.label;
}

function validateCredentials(id, password, mode) {
  if (!ID_PATTERN.test(id)) throw new Error("아이디는 2~30자의 문자, 숫자, ., _, -만 사용할 수 있습니다.");
  if (password.length < 6) throw new Error("비밀번호는 6자 이상 입력해주세요.");

  if (mode === "signup") {
    const confirmPassword = document.querySelector("#confirm-password")?.value || "";
    const hint = normalizeHint(document.querySelector("#password-hint")?.value || "");
    if (password !== confirmPassword) throw new Error("비밀번호가 서로 다릅니다.");
    if (hint && hint.toLowerCase() === password.toLowerCase()) {
      throw new Error("비밀번호 자체를 힌트로 사용할 수 없습니다.");
    }
  }
}

async function savePasswordHint(payload, id, hint) {
  const cleanHint = normalizeHint(hint);
  const session = getSession(payload);
  if (!cleanHint || !session?.access_token || !session.user?.id) return;

  await requestRest("password_hints?on_conflict=login_id", {
    method: "POST",
    token: session.access_token,
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      login_id: id,
      user_id: session.user.id,
      hint: cleanHint,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function fetchPasswordHint(id) {
  const rows = await requestRest(`password_hints?select=hint&login_id=eq.${encodeURIComponent(id)}&limit=1`);
  return Array.isArray(rows) ? rows[0]?.hint || "" : "";
}

function setHintResult(form, text, type = "info") {
  const result = form.querySelector("[data-password-hint-result]");
  if (!result) return;
  result.hidden = false;
  result.textContent = text;
  result.dataset.type = type;
}

async function handleHintClick(event) {
  const form = event.currentTarget.closest("[data-auth-form]");
  const id = normalizeId(form.querySelector("#user-id")?.value || "");

  if (!id) {
    setHintResult(form, "아이디를 먼저 입력해주세요.", "error");
    return;
  }
  if (!ID_PATTERN.test(id)) {
    setHintResult(form, "올바른 아이디를 입력해주세요.", "error");
    return;
  }

  event.currentTarget.disabled = true;
  event.currentTarget.textContent = "확인 중";
  try {
    const hint = await fetchPasswordHint(id);
    setHintResult(form, hint || "저장된 힌트가 없습니다.", hint ? "success" : "info");
  } catch {
    setHintResult(form, "힌트를 불러오지 못했습니다.", "error");
  } finally {
    event.currentTarget.disabled = false;
    event.currentTarget.textContent = "비밀번호 힌트";
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const mode = form.dataset.mode;
  const id = normalizeId(form.querySelector("#user-id").value);
  const password = form.querySelector("#password").value;
  const passwordHint = normalizeHint(form.querySelector("#password-hint")?.value || "");

  try {
    setBusy(form, true);
    validateCredentials(id, password, mode);

    const email = idToEmail(id);
    const payload =
      mode === "signup"
        ? await requestAuth("signup", {
            email,
            password,
            data: { login_id: id, username: id },
          })
        : await requestAuth("token?grant_type=password", { email, password });

    const hasSession = saveSession(payload, id);
    if (mode === "signup" && hasSession) await savePasswordHint(payload, id, passwordHint);

    if (mode === "signup" && !hasSession) {
      setMessage(form, "회원가입 요청이 완료되었습니다. 로그인 후 사용할 수 있습니다.", "success");
      return;
    }

    setMessage(form, mode === "signup" ? "회원가입이 완료되었습니다." : "로그인되었습니다.", "success");
    window.setTimeout(() => {
      window.location.href = "./";
    }, 650);
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

document.querySelectorAll("[data-password-hint-trigger]").forEach((button) => {
  button.addEventListener("click", handleHintClick);
});
