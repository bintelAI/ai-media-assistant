(async function(){
  const scriptEl=document.currentScript;
  const newScriptEl=document.createElement('script');
  for(const attr of scriptEl.attributes){
    newScriptEl.setAttribute(attr.name,attr.value)
  }
  newScriptEl.src=scriptEl.src+"?final";
  try{
    const code=await fetch(scriptEl.src).then(res=>res.text());
    if(!code)throw new Error("script fetch failed.");
    console.log('[智联AI] vendor-dynamic: 获取到代码长度:', code.length);
    const patchedCode=injectRegisterHttpSimple(code);
    const blob=new Blob([patchedCode],{type:'application/javascript'});
    const blobUrl=URL.createObjectURL(blob);
    console.log('[智联AI] vendor-dynamic: 创建 blob URL:', blobUrl);
    newScriptEl.src=blobUrl;
    newScriptEl.addEventListener('load',()=>{
      console.log('[智联AI] vendor-dynamic: 补丁脚本加载成功');
      if(window._smzsRequest){
        console.log('[智联AI] vendor-dynamic: _smzsRequest 已成功注入:', typeof window._smzsRequest);
      }else{
        console.warn('[智联AI] vendor-dynamic: _smzsRequest 未注入');
      }
      URL.revokeObjectURL(blobUrl)
    },{once:true});
    newScriptEl.addEventListener('error',(e)=>{
      console.error('[智联AI] vendor-dynamic: 补丁脚本加载失败:', e);
      URL.revokeObjectURL(blobUrl)
    });
  }catch(e){
    console.error('[智联AI] vendor-dynamic: 获取失败:', e);
  }finally{
    scriptEl.after(newScriptEl)
  }
})();

function injectRegisterHttpSimple(a){
  const re=/function\s+registerHttp\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{\s*/;
  if(!re.test(a)){
    console.warn('[智联AI] vendor-dynamic: 未找到 registerHttp 函数定义');
    return a
  }
  console.log('[智联AI] vendor-dynamic: 找到 registerHttp 函数定义');
  return a.replace(re,(match,param)=>{
    console.log('[智联AI] vendor-dynamic: 参数名:', param);
    const injection=`window._smzsRequest=${param};console.log("[智联AI] vendor-dynamic: HTTP client 已劫持");`;
    console.log('[智联AI] vendor-dynamic: 注入代码:', injection);
    return match+injection
  })
}
