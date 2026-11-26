import {authPage, frame, esc, icon} from "./views.mjs";

const root = document.getElementById("app");
const fmt = new Intl.DateTimeFormat("ru-RU",{dateStyle:"short",timeStyle:"medium"});
const asDay = date => [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
const today = new Date();
let from = asDay(new Date(today.getFullYear(),today.getMonth(),1)), to = asDay(today);
let user = null, rows = [], revision = 0;
const range = () => {
  const start = new Date(from+"T00:00:00"), until = new Date(to+"T00:00:00");
  if (asDay(start)!==from || asDay(until)!==to || start>until) throw Error("Проверьте даты начала и окончания.");
  until.setDate(until.getDate()+1);
  return new URLSearchParams({start:String(+start),end:String(+until)});
};
async function api(path,body) {
  let res;
  try { res=await fetch("/api/"+path,body===undefined?{cache:"no-store"}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); }
  catch { throw Error("Нет связи с сервером. Повторите попытку."); }
  let data;
  try { data=await res.json(); } catch { throw Error("Сервер временно недоступен. Повторите попытку."); }
  if (!res.ok) {
    if(res.status===401 && user){ user=null; revision++; rows=[]; closeDialog(); root.innerHTML=authPage("login","","Сессия завершена. Войдите снова."); }
    throw Error(data.error || "Не удалось выполнить запрос.");
  }
  return data;
}
function message(text) { const note=document.getElementById("formnote"); if(note){note.classList.remove("good");note.textContent=text;} }
function closeDialog(){document.querySelector("dialog[open]")?.close();}
function openDialog(title,inside) {
  closeDialog();
  const d=document.createElement("dialog");
  d.setAttribute("aria-labelledby","dialog-title");
  d.innerHTML=`<div class="modalhead"><h2 id="dialog-title">${esc(title)}</h2><button class="plain" aria-label="Закрыть" data-action="close">${icon("close")}</button></div><div class="modalbody">${inside}</div>`;
  document.body.append(d);d.addEventListener("close",()=>d.remove(),{once:true});
  d.addEventListener("click",e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
  d.showModal();return d;
}
function help() {
  openDialog("Как работает журнал",`<h3>Регистрация и вход</h3><p>Создайте логин и пароль. ${document.documentElement.dataset.local ? "Первый зарегистрированный локальный аккаунт получает права администратора." : "Владелец сайта назначает администратора."} После регистрации войдите с этими данными.</p>
  <h3>Учёт посещений</h3><p>Каждый успешный вход добавляет одну запись. Обновление страницы и продолжение открытой сессии сохраняют прежнее число входов.</p>
  <h3>Просмотр отчёта</h3><p>Выберите даты и нажмите «Показать». Пользователи видят свои входы. Администратор видит всех, включая пользователей с нулём входов.</p><p>Кнопка «Консоль» открывает текстовый просмотр. Команда <b>помощь</b> выводит список команд.</p>`);
}
const stat = (label, value, sym) => `<div class="stat"><small>${label}</small><strong>${value}</strong><span class="tile">${icon(sym)}</span></div>`;
function dashboard(waiting=false) {
  if(!user)return;
  const admin=user.role==="admin", total=rows.reduce((s,r)=>s+r.count,0);
  root.innerHTML=frame(`<div class="worktitle"><div><h1>${admin?"Журнал посещений":"Мои посещения"}</h1><p class="sub">${admin?"Сводка активности всех пользователей.":"История входов в ваш аккаунт."}</p></div>
  <div class="account"><span class="avatar">${esc(user.name.slice(0,1).toUpperCase())}</span><div>${esc(user.name)}<small>${admin?"Администратор":"Пользователь"}</small></div></div></div>
  <div class="stats">${stat("Входов за период",waiting?"…":total,"chart")}${admin?stat("Заходили на сайт",waiting?"…":rows.filter(x=>x.count).length,"people")+stat("Всего пользователей",waiting?"…":rows.length,"user"):stat("Последний вход за период",waiting?"…":rows[0]?.latest?new Date(rows[0].latest).toLocaleDateString("ru-RU"):"—","calendar")+stat("ID аккаунта",user.id,"user")}</div>
  <section class="box"><div class="row"><h2>Отчёт за период</h2><button class="plain" data-action="console">${icon("terminal")}Консоль</button></div>
  <form class="filter" id="filter"><label>С даты<input required type="date" name="from" value="${esc(from)}"></label><label>По дату включительно<input required type="date" name="to" value="${esc(to)}"></label><button class="primary">Показать</button></form>
  <p class="notice" id="formnote" role="status"></p><div class="tablewrap"><table><thead><tr><th>ID</th><th>Пользователь</th><th>Входов</th><th>Последний вход</th><th><span class="sr">Действие</span></th></tr></thead><tbody>${waiting?'<tr><td colspan="5">Загрузка…</td></tr>':rows.map(r=>`<tr><td>${r.id}</td><td class="acccell">${esc(r.name)}<small>${esc(r.login)}</small></td><td>${r.count}</td><td>${r.latest?fmt.format(r.latest):"—"}</td><td><button class="link" data-id="${r.id}" aria-label="История входов: ${esc(r.name)}">История</button></td></tr>`).join("")}</tbody></table></div></section>`,true);
}
async function loadReport() {
  const key=++revision;
  const params=range();dashboard(true);
  try {
    const result=await api("report?"+params);
    if(key!==revision || !user)return;
    rows=result.rows;dashboard();
  } catch(err){if(key===revision && user){rows=[];dashboard();message(err.message);}}
}
async function history(id) {
  const d=openDialog("История входов",'<p role="status">Загрузка…</p>');
  try { const data=await api("history?"+range()+"&id="+id);
    const dates=`${from.split("-").reverse().join(".")} — ${to.split("-").reverse().join(".")}`;
    d.querySelector(".modalbody").innerHTML=`<p><b>${esc(data.account.name)}</b> · ${esc(data.account.login)}<br>${dates}</p>${data.visits.length?`<ul class="history">${data.visits.map(v=>`<li>${icon("clock")}${fmt.format(v)}</li>`).join("")}</ul>`:"<p>За этот период входов нет.</p>"}`;
  } catch(err){d.querySelector(".modalbody").textContent=err.message;}
}
const commands="сводка — список пользователей и число входов\nпериод ГГГГ-ММ-ДД ГГГГ-ММ-ДД — выбрать даты\nистория ID — даты и время входов\nпомощь — список команд\nвыход — закрыть консоль";
function openConsole() {
  const d=openDialog("Консоль посещаемости",`<pre class="cmdout" aria-live="polite"></pre><form class="cmdform"><input class="cmdinput" aria-label="Команда" placeholder="Введите команду" required autocomplete="off"><button class="primary">Выполнить</button></form>`);
  const out=d.querySelector(".cmdout"), form=d.querySelector("form"), input=form.querySelector("input");
  out.textContent=`Период ${from} — ${to}\n\n${commands}`;input.focus();
  form.addEventListener("submit",async e=>{
    e.preventDefault();const line=input.value.trim();if(!line)return;
    const [cmd,...args]=line.toLowerCase().split(/\s+/);input.value="";input.disabled=true;
    out.textContent+="\n\n> "+line;
    try {
      let result;
      if(cmd==="выход"){d.close();return;}
      if(cmd==="помощь")result=commands;
      else if(cmd==="сводка"){
        const report=await api("report?"+range());
        result=report.rows.map(r=>`#${r.id}  ${r.name} (${r.login}) · входов: ${r.count} · ${r.latest?fmt.format(r.latest):"—"}`).join("\n");
      }else if(cmd==="история" && args.length===1 && /^\d+$/.test(args[0])){
        const data=await api("history?"+range()+"&id="+args[0]);result=data.account.name+"\n"+(data.visits.map(v=>fmt.format(v)).join("\n")||"За этот период входов нет.");
      }else if(cmd==="период" && args.length===2){const prev=[from,to];[from,to]=args;try{range();}catch(err){[from,to]=prev;throw err;}await loadReport();result=`Период: ${from} — ${to}`;}
      else result="Неизвестная команда или аргументы. Введите «помощь».";
      out.textContent+="\n"+result;
    } catch(err){out.textContent+="\n"+err.message;}
    finally{input.disabled=false;input.focus();out.scrollTop=out.scrollHeight;}
  });
}
document.addEventListener("click",async e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.hasAttribute("data-mode")){root.innerHTML=authPage(b.dataset.mode);return;}
  if(b.dataset.id){await history(b.dataset.id);return;}
  switch(b.dataset.action){
    case "close":closeDialog();break;
    case "help":help();break;
    case "console":openConsole();break;
    case "eye":{const p=document.getElementById("f-password"),show=p.type==="password";p.type=show?"text":"password";b.setAttribute("aria-label",show?"Скрыть пароль":"Показать пароль");b.innerHTML=icon(show?"hide":"eye");break;}
    case "logout":b.disabled=true;try{await api("logout",{});revision++;rows=[];user=null;root.innerHTML=authPage();}catch(err){message(err.message);b.disabled=false;}break;
  }
});
document.addEventListener("submit",async e=>{
  const form=e.target;
  if(form.id!=="auth" && form.id!=="filter")return;
  e.preventDefault();const data=Object.fromEntries(new FormData(form));
  if(form.id==="filter"){const prev=[from,to];from=data.from;to=data.to;try{range();}catch(err){[from,to]=prev;message(err.message);return;}await loadReport();return;}
  const submit=form.querySelector('[type="submit"]');submit.disabled=true;
  try{
    if(form.dataset.mode==="register"){await api("register",data);root.innerHTML=authPage("login",data.login,"Аккаунт создан. Введите пароль, чтобы войти.");document.getElementById("f-password").focus();}
    else{const result=await api("login",data);user=result.user;await loadReport();}
  }catch(err){message(err.message);}finally{submit.disabled=false;}
});
api("session").then(async s=>{if(s.user && !user){user=s.user;await loadReport();}}).catch(err=>message(err.message));
