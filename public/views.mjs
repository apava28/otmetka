const paths = {
  user:'<circle cx="12" cy="8" r="3.4"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  eye:'<path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  hide:'<path d="m3 3 18 18M10.4 5.1A13 13 0 0 1 12 5c6.2 0 10 7 10 7a20 20 0 0 1-3 3.9M6.4 6.4A21 21 0 0 0 2 12s3.8 7 10 7c1.6 0 3.1-.5 4.3-1.1"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.4 2.3c-.9.5-1.2 1-1.2 2M12 16.8h.01"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  shield:'<path d="M12 3 4.5 6v5.5c0 4.3 3.2 7.7 7.5 9.5 4.3-1.8 7.5-5.2 7.5-9.5V6L12 3Z"/><path d="m8.7 11.9 2.3 2.3 4.4-4.7"/>',
  terminal:'<rect x="2.5" y="4.5" width="19" height="15" rx="3"/><path d="m6 9 3 3-3 3m6 0h5"/>',
  people:'<circle cx="9" cy="8" r="3"/><path d="M2 20v-2a7 7 0 0 1 14 0v2m-1-15a3 3 0 0 1 0 6m3 3a5 5 0 0 1 3 5"/>',
  chart:'<path d="M3 3v18h18M8 16v-4m5 4V7m5 9v-6"/>',
  exit:'<path d="M9 5H5v14h4m4-12 5 5-5 5m5-5H9"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  dots:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>'
};
export const icon = (key) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]}</svg>`;
export const esc = value => String(value).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const mark = '<span class="logomark" aria-hidden="true"><i></i><i></i><i></i></span>';
export function frame(content, logged=false) {
  return `<header class="sitehead"><div class="headin"><div class="brand">${mark}Отметка</div><div class="headtools"><button class="plain" data-action="help">${icon("help")}Справка</button>${logged?`<button class="plain" data-action="logout">${icon("exit")}Выйти</button>`:""}</div></div></header>
  <main class="${logged?"workmain":"authmain"}">${content}</main><footer><span>Отметка <b> / </b> Система учёта посещаемости</span><span class="footright">${icon("clock")} Местное время</span></footer>`;
}
function illustration() {
  const values = [1,2,0,1,0,2,3,0,1,1,3,1,2,0,0,0,2,3,4,3,2,1,1,2,3,4,4,2,3,1,0,1,2,3,4,4,3,2,0,0,1,3,2,3,4,1,1,0,2,2,3,1,2,3,1,0];
  return `<div class="illustration" role="img" aria-label="Иллюстрация календаря активности: объёмная сетка синих ячеек и отметка входа"><div class="halo"></div><div class="orbit o1"></div><div class="orbit o2"></div><div class="plate base"></div><div class="plate mid"></div><div class="plate top"><div class="gridcells">${values.map(v=>`<i class="c${v}"></i>`).join("")}</div></div><div class="pin"><span>${icon("check")}</span></div><div class="speck s1">+</div><div class="speck s2">+</div><div class="speck s3">+</div></div>`;
}
export function authPage(mode="login", login="", message="") {
  const reg=mode==="register";
  return frame(`<div class="authcard"><section class="poster"><div class="postertext"><div class="eyebrow"><span class="tinyline"></span>УЧЁТ ПОСЕЩАЕМОСТИ</div><h1>Журнал<br>посещений<span>.</span></h1><p>История входов и отчёты<br>по пользователям.</p></div>${illustration()}<div class="posterlegend"><span>Активность</span><i></i><i></i><i></i><i></i><i></i></div></section>
  <section class="authform"><div class="formwrap"><nav class="segments" aria-label="Доступ к аккаунту"><button data-mode="login" aria-pressed="${!reg}">Вход</button><button data-mode="register" aria-pressed="${reg}">Регистрация</button></nav>
  <h2>${reg?"Создать аккаунт":"Вход в аккаунт"}</h2><p class="sub">${reg?"Зарегистрируйтесь для учёта ваших входов.":"Введите свои данные для входа в систему."}</p>
  <form id="auth" data-mode="${mode}">${reg?field("Имя","name","Как к вам обращаться","user",'autocomplete="name" maxlength="60"'):""}
  ${field("Логин","login","Введите логин","user",'autocomplete="username" minlength="3" maxlength="40" autocapitalize="none" spellcheck="false"',login)}
  ${field("Пароль","password",reg?"Придумайте пароль":"Введите пароль","lock",`autocomplete="${reg?"new-password":"current-password"}" maxlength="128" ${reg?'minlength="8"':''}`)}
  ${reg?'<small class="hint">Минимум 8 символов.</small>':""}<p id="formnote" class="notice ${message?"good":""}" role="status">${esc(message)}</p><button class="primary full" type="submit">${reg?"Зарегистрироваться":"Войти"}</button></form>
  <div class="switchline">${reg?"Уже есть аккаунт?":"Нет аккаунта?"} <button data-mode="${reg?"login":"register"}">${reg?"Войти":"Зарегистрироваться"}</button></div></div></section></div>`);
}
function field(label, name, placeholder, sym, attrs, val="") {
  return `<label for="f-${name}">${label}</label><div class="inputbox">${icon(sym)}<input id="f-${name}" name="${name}" type="${name==="password"?"password":"text"}" required placeholder="${placeholder}" value="${esc(val)}" ${attrs}>${name==="password"?`<button type="button" data-action="eye" aria-label="Показать пароль">${icon("eye")}</button>`:""}</div>`;
}
