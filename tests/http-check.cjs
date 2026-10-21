const assert = require('node:assert/strict');
const vm = require('node:vm');
const base = process.argv[2] || 'http://127.0.0.1:9362';
(async () => {
  let res = await fetch(base+'/');
  assert.equal(res.status,200);
  const html = await res.text();
  assert(html.includes('桌游身份发放工具'));
  assert(!/__STYLES__|__CORE__|__UI__|__EDITORIAL_ART__|__ROLE_ART_IMAGE__/.test(html));
  new vm.Script(html.split('<script>')[1].split('</script>')[0]);
  assert(res.headers.get('x-content-type-options').split(',').every(value=>value.trim()==='nosniff'));
  assert(res.headers.get('x-frame-options').split(',').every(value=>value.trim()==='DENY'));
  assert(res.headers.get('content-security-policy').includes("connect-src 'none'"));
  assert.equal(res.headers.get('content-encoding'),'gzip');
  const etag=res.headers.get('etag');
  res=await fetch(base+'/',{headers:{'If-None-Match':etag}}); assert.equal(res.status,304);
  for(const name of ['masquerade-print','role-sigils']) { res=await fetch(base+'/assets/'+name+'.webp'); assert.equal(res.status,200); assert.equal(res.headers.get('content-type'),'image/webp'); assert((await res.arrayBuffer()).byteLength>10000); }
  res=await fetch(base+'/healthz'); assert.equal(res.status,200); assert.equal((await res.json()).status,'ok');
  for(const url of ['/src/game-core.js','/.env','/.git/config','/server.cjs','/missing']) {res=await fetch(base+url);assert.equal(res.status,404);}
  res=await fetch(base+'/',{method:'POST'});assert.equal(res.status,405);
  res=await fetch(base+'/',{method:'HEAD'});assert.equal(res.status,200);assert.equal((await res.text()).length,0);
  console.log(JSON.stringify({base,passed:true,checks:['page','syntax','gzip','etag','webp','health','privatePaths','methods','headers']}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
