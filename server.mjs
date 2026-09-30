import http from 'node:http';
import {readFile} from 'node:fs/promises';
const upstream=process.env.APPS_SCRIPT_URL;
const files={'/':['index.html','text/html; charset=utf-8'],'/manifest.webmanifest':['manifest.webmanifest','application/manifest+json'],'/icon.png':['icon.png','image/png'],'/icon-192.png':['icon-192.png','image/png'],'/sw.js':['sw.js','text/javascript']};
const allowed=new Set(['snapshot','getMedia','addOrder','editOrder','separateOrder','releaseBatch','respondBatch','receiveOrder','receiveOrders','receiveReturn','enqueueNotification']);
http.createServer(async(req,res)=>{
 res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
 const path=new URL(req.url,'http://local').pathname;
 if(path==='/health'){res.end('ok');return;}
 if(path==='/api'&&req.method==='POST'){
  res.setHeader('Content-Type','application/json');
  try{if(!upstream)throw Error('Serviço em configuração.');if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){res.writeHead(403);res.end(JSON.stringify({ok:false,error:'Origem inválida.'}));return;}
   let body='',bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>29000000)throw Error('Arquivo acima do limite.');body+=chunk;}
   const input=JSON.parse(body);if(!allowed.has(input.method)||!Array.isArray(input.args)||!/^[a-f0-9]{64}$/.test(input.args[0]?.token||''))throw Error('Use o link exclusivo da sua loja.');
   const attempts=['snapshot','getMedia'].includes(input.method)?3:1;let result;
   for(let attempt=0;attempt<attempts;attempt++){
    try{const r=await fetch(upstream,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(input),redirect:'follow',signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('Upstream HTTP '+r.status);result=await r.json();break;}
    catch(error){console.warn('Apps Script connection failed',input.method,attempt+1,error.cause?.code||error.name);if(attempt===attempts-1)throw error;await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}
   }
   res.end(JSON.stringify(result));
  }catch(e){res.statusCode=502;res.end(JSON.stringify({ok:false,error:'Não foi possível concluir. Atualize a lista antes de tentar novamente.'}));}return;
 }
 if(req.method==='GET'&&files[path]){try{const [f,t]=files[path];res.setHeader('Content-Type',t);res.end(await readFile(new URL(f,import.meta.url)));}catch{res.writeHead(500);res.end('Unavailable');}return;}
 res.writeHead(404);res.end('Not found');
}).listen(process.env.PORT||3000,'0.0.0.0');
