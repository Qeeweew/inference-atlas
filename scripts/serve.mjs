import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const port=Number(process.env.ATLAS_PORT||4174);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
if(!fs.existsSync(path.join(root,'index.html')))throw Error('缺少构建输出，请先 npm run build');
const server=http.createServer((req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end();return}
 const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 let real;
 try{real=fs.realpathSync(target)}catch{res.writeHead(404);res.end('Not found');return}
 if(!real.startsWith(root+path.sep)||!fs.statSync(real).isFile()){res.writeHead(403);res.end('Forbidden');return}
 res.writeHead(200,{'Content-Type':types[path.extname(real)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache'});
 if(req.method==='HEAD')res.end();else fs.createReadStream(real).pipe(res);
});
server.listen(port,'127.0.0.1',()=>console.log(`推理架构图谱已启动：http://127.0.0.1:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
