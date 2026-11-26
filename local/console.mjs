import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

const endpoint = new URL(process.env.OTMETKA_URL || "http://127.0.0.1:"+Number(process.env.PORT || 8000));
if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && ["localhost","127.0.0.1"].includes(endpoint.hostname))) {
  throw Error("Для подключения к размещённому сайту укажите HTTPS-адрес.");
}
const origin = endpoint.origin;
let muted=false;
const output=new Writable({write(chunk,encoding,next){if(!muted)process.stdout.write(chunk,encoding);next();}});
const rl=createInterface({input:process.stdin,output,terminal:!!process.stdin.isTTY});
const ask=q=>rl.question(q);
let cookie="";
async function api(path,body) {
  const response=await fetch(origin+"/api/"+path,{redirect:"error",method:body?"POST":"GET",headers:{"Content-Type":"application/json",Cookie:cookie},body:body?JSON.stringify(body):undefined});
  if(response.headers.has("set-cookie"))cookie=response.headers.get("set-cookie").split(";")[0];
  const data=await response.json();
  if(!response.ok)throw Error(data.error || "Ошибка запроса.");
  return data;
}
function boundary(value,exclusiveEnd) {
  const match=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if(!match)throw Error("Введите дату в формате ДД.ММ.ГГГГ.");
  const [,d,m,y]=match;const date=new Date(+y,+m-1,+d);
  if(date.getDate()!==+d || date.getMonth()!==+m-1 || date.getFullYear()!==+y)throw Error("Такой даты не существует.");
  if(exclusiveEnd)date.setDate(date.getDate()+1);
  return +date;
}
const fmt=n=>new Date(n).toLocaleString("ru-RU");
try{
  console.log("Отметка · консоль посещаемости");
  const login=(await ask("Логин: ")).trim();
  process.stdout.write("Пароль: ");muted=true;
  let password;try{password=await ask("");}finally{muted=false;process.stdout.write("\n");}
  const {user}=await api("login",{login,password});password="";
  console.log("Выполнен вход: "+user.name+" ("+(user.role==="admin"?"администратор":"пользователь")+")");
  let running=true;
  while(running){
    try{
      const from=await ask("Дата начала (ДД.ММ.ГГГГ) или 0 для выхода: ");if(from==="0")break;
      const start=boundary(from,false);
      const end=boundary(await ask("Дата конца (ДД.ММ.ГГГГ): "),true);
      if(start>=end)throw Error("Дата начала должна быть не позже даты конца.");
      const range=new URLSearchParams({start:String(start),end:String(end)});
      const {rows}=await api("report?"+range);
      console.table(rows.map(r=>({ID:r.id,"Имя":r.name,"Логин":r.login,"Входов":r.count,"Последний вход":r.latest?fmt(r.latest):"—"})));
      console.log(`Заходили: ${rows.filter(r=>r.count).length} из ${rows.length}. Всего входов: ${rows.reduce((n,r)=>n+r.count,0)}.`);
      while(running){
        const id=(await ask("ID для истории, Enter для смены периода, 0 для выхода: ")).trim();
        if(!id)break;if(id==="0"){running=false;break;}
        if(!/^\d+$/.test(id)){console.log("Введите числовой ID.");continue;}
        try{const data=await api("history?"+range+"&id="+id);console.log(data.account.name);console.log(data.visits.map(fmt).join("\n")||"За этот период входов нет.");}catch(err){console.log(err.message);}
      }
    }catch(err){if(err.code==="ERR_USE_AFTER_CLOSE")break;console.log(err.message);}
  }
}catch(err){console.error(err.message==="fetch failed"?"Проверьте адрес сайта. Для локального запуска выполните node local/server.mjs":err.message);process.exitCode=1;}
finally{if(cookie)await api("logout",{}).catch(()=>{});rl.close();}
