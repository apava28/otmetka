import { summaryQuery, historyQuery, timeRange } from "./reports.mjs";

const encoder = new TextEncoder();
const day = 86400000;
const hex = value => [...new Uint8Array(value)].map(n => n.toString(16).padStart(2, "0")).join("");
const randomHex = size => hex(crypto.getRandomValues(new Uint8Array(size)));
async function digest(value) { return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value))); }
async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 100000 }, key, 256));
}
function sameHash(a, b) {
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
function reply(body, status = 200, cookie) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (cookie) headers["Set-Cookie"] = cookie;
  return Response.json(body, { status, headers });
}
function error(message, status = 400) { return reply({error: message}, status); }
function userView(a) { return { id: a.id, name: a.name, login: a.login, role: a.role }; }
async function limited(db, key, now, limit) {
  const record = await db.prepare(`INSERT INTO attempts (key,count,until) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until<=? THEN 1 ELSE count+1 END,
    until=CASE WHEN until<=? THEN excluded.until ELSE until END RETURNING count`)
    .bind(key, now + 10*60000, now, now).first();
  return record.count > limit;
}

export async function handleApi(req, db, { firstAccountIsAdmin = false } = {}) {
  const url = new URL(req.url);
  const path = url.pathname;
  const now = Date.now();
  const post = req.method === "POST";
  if (!post && req.method !== "GET") return error("Метод недоступен.", 405);
  if (post && ((req.headers.get("origin") && req.headers.get("origin") !== url.origin) ||
      !req.headers.get("content-type")?.startsWith("application/json"))) return error("Запрос отклонён.", 403);
  const cookie = /(?:^|;\s*)otmetka=([a-f0-9]{64})(?:;|$)/.exec(req.headers.get("Cookie") || "");
  const sessionHash = cookie ? await digest(cookie[1]) : "";
  const current = sessionHash && await db.prepare(`SELECT a.id,a.login,a.name,a.role FROM sessions s
    JOIN accounts a ON a.id=s.account WHERE s.hash=? AND s.expires>?`).bind(sessionHash, now).first();
  const cookieValue = (v, seconds) => `otmetka=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${url.protocol==="https:"?"; Secure":""}`;
  if (path === "/api/session" && !post) return reply({user: current ? userView(current) : null});
  if (path === "/api/logout" && post) {
    if (sessionHash) await db.prepare("DELETE FROM sessions WHERE hash=?").bind(sessionHash).run();
    return reply({ok:true}, 200, cookieValue("", 0));
  }
  if (post && ["/api/register","/api/login"].includes(path)) {
    let body;
    try { body = await req.json(); } catch { return error("Неверный формат запроса."); }
    const login = typeof body?.login === "string" ? body.login.trim().toLowerCase() : "";
    const password = body?.password;
    if (!/^[a-zа-яё0-9._-]{3,40}$/u.test(login) || typeof password !== "string" || !password || password.length > 128)
      return error("Введите логин от 3 до 40 символов и пароль до 128 символов.");
    const networkKey = await digest(req.headers.get("cf-connecting-ip") || "local");
    const isRegister = path.endsWith("register");
    if (await limited(db, (isRegister?"register:":"login:")+networkKey, now, isRegister?30:60))
      return error("Слишком много попыток. Попробуйте через 10 минут.", 429);
    if (isRegister) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 60 || password.length < 8) return error("Укажите имя до 60 символов и пароль от 8 до 128 символов.");
      const salt = randomHex(16);
      const passwordHash = await hashPassword(password,salt);
      const account = await db.prepare(`INSERT INTO accounts(login,name,salt,password_hash,role)
        SELECT ?,?,?,?,CASE WHEN ? = 1 AND NOT EXISTS(SELECT 1 FROM accounts) THEN 'admin' ELSE 'user' END
        ON CONFLICT(login) DO NOTHING RETURNING id`).bind(login,name,salt,passwordHash,Number(firstAccountIsAdmin)).first();
      return account ? reply({ok:true},201) : error("Этот логин уже занят.",409);
    }
    if (await limited(db,"attempt:"+login,now,12)) return error("Слишком много попыток. Попробуйте через 10 минут.",429);
    const account = await db.prepare("SELECT * FROM accounts WHERE login=?").bind(login).first();
    const hash = await hashPassword(password,account?.salt || "00000000000000000000000000000000");
    if (!account || !sameHash(hash,account.password_hash)) return error("Неверный логин или пароль.",401);
    const token = randomHex(32);
    await db.batch([
      db.prepare("DELETE FROM sessions WHERE hash=? OR expires<=?").bind(sessionHash, now),
      db.prepare("INSERT INTO sessions(hash,account,expires) VALUES(?,?,?)").bind(await digest(token), account.id, now + 7*day),
      db.prepare("INSERT INTO visits(account,moment) VALUES(?,?)").bind(account.id,now),
      db.prepare("DELETE FROM attempts WHERE key=? OR until<=?").bind("attempt:"+login,now),
    ]);
    return reply({user:userView(account)},200,cookieValue(token,7*day/1000));
  }
  if (!current) return error("Войдите в аккаунт.",401);
  if (!post && (path === "/api/report" || path === "/api/history")) {
    let start, end;
    try {
      const a = url.searchParams.get("start"), b = url.searchParams.get("end");
      if (!a || !b) throw new Error();
      [start,end] = timeRange(Number(a), Number(b));
    } catch { return error("Укажите корректный период."); }
    if (path === "/api/report") {
      const {results} = await summaryQuery(db,start,end,current.role==="admin"?null:current.id).all();
      return reply({rows:results});
    }
    const id = Number(url.searchParams.get("id"));
    if (!Number.isSafeInteger(id) || id < 1) return error("Неверный ID пользователя.");
    if (id !== current.id && current.role !== "admin") return error("История доступна только владельцу и администратору.",403);
    const account = await db.prepare("SELECT id,name,login FROM accounts WHERE id=?").bind(id).first();
    if (!account) return error("Пользователь не найден.",404);
    const {results} = await historyQuery(db,start,end,id).all();
    return reply({account, visits:results.map(r=>r.moment)});
  }
  return error("Страница не найдена.",404);
}
