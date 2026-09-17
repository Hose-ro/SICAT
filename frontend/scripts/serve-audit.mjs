import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
const root=path.resolve('dist')
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'}
createServer(async(req,res)=>{
 try {
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname)
  let file=path.resolve(root,'.'+pathname)
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end()}
  if(!path.extname(file))file=path.join(root,'index.html')
  const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(body)
 }catch{res.writeHead(404);res.end('Not found')}
}).listen(4176,'127.0.0.1')
