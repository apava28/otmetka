import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./database.mjs";
import { handleApi } from "../core/api.mjs";
import { authPage } from "../public/views.mjs";

const port = Number(process.env.PORT || 8000);
const origin = "http://127.0.0.1:"+port;
const db = openDatabase(process.env.OTMETKA_DB || fileURLToPath(new URL("../otmetka.sqlite",import.meta.url)));
const types={"/journal.js":"text/javascript","/views.mjs":"text/javascript","/journal.css":"text/css","/favicon.svg":"image/svg+xml"};
const html = `<!doctype html><html lang="ru" data-local="true"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Отметка — журнал посещений</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/journal.css"></head><body><div id="app">${authPage()}</div><script type="module" src="/journal.js"></script></body></html>`;
createServer(async (req,res)=>{
  try {
    const host=req.headers.host;
    if(host!==new URL(origin).host && host!=="localhost:"+port){res.writeHead(400);res.end();return;}
    const url=new URL(req.url, "http://"+host);
    if(url.pathname.startsWith("/api/")){
      const chunks=[];let length=0;
      for await(const chunk of req){length+=chunk.length;if(length>16384){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const headers=new Headers(req.headers);
      headers.set("cf-connecting-ip",req.socket.remoteAddress || "local");
      const request=new Request(url,{method:req.method,headers,body:chunks.length?Buffer.concat(chunks):undefined});
      const result=await handleApi(request,db,{ firstAccountIsAdmin: true });
      res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));return;
    }
    if(req.method!=="GET" && req.method!=="HEAD"){res.writeHead(405);res.end();return;}
    if(url.pathname==="/"){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});res.end(html);return;}
    if(Object.hasOwn(types,url.pathname)){
      const source=new URL("../public"+url.pathname,import.meta.url);
      let data;
      try{data=await readFile(source);}catch(e){if(e.code!=="ENOENT")throw e;res.writeHead(404);res.end("Файл не найден.");return;}
      res.writeHead(200,{"Content-Type":types[url.pathname],"X-Content-Type-Options":"nosniff"});res.end(data);return;
    }
    res.writeHead(404);res.end();
  }catch(err){console.error("Ошибка сервера:",err.message);if(!res.headersSent)res.writeHead(500);res.end();}
}).listen(port,"127.0.0.1",()=>console.log("Сайт «Отметка» открыт по адресу "+origin));
