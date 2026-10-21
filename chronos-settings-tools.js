/* CHRONOS Settings Tools — additive repair for OpenRouter configuration.
   Adds explicit Save Key Locally and Test Key controls without replacing
   existing settings, playback, temporal-vision, navigator, or Futurecast logic. */
(()=>{'use strict';
  const $=id=>document.getElementById(id);
  const toast=message=>{const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(toast._timer);toast._timer=setTimeout(()=>el.classList.remove('show'),2800)};
  const keyInput=$('apiKey');
  const modelSelect=$('modelSelect');
  const modelId=$('modelId');
  const visionModelId=$('visionModelId');
  const modalBody=document.querySelector('#settingsModal .modal-body');
  if(!keyInput||!modalBody||$('saveKeyLocally')||$('testOpenRouterKey'))return;

  const row=document.createElement('div');
  row.className='settings-key-tools';
  row.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:-5px 0 14px';

  const save=document.createElement('button');
  save.type='button';save.id='saveKeyLocally';save.className='btn';save.textContent='Save Key Locally';
  save.title='Save the OpenRouter key only in this browser';

  const test=document.createElement('button');
  test.type='button';test.id='testOpenRouterKey';test.className='btn';test.textContent='Test Key';
  test.title='Test the OpenRouter key without generating a video';

  const status=document.createElement('span');
  status.id='openRouterKeyTestStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  status.style.cssText='flex:1;min-width:180px;align-self:center;font-size:10px;color:#8298a8;overflow-wrap:anywhere';
  row.append(save,test,status);
  keyInput.parentElement.insertAdjacentElement('afterend',row);

  const readKey=()=>keyInput.value.trim();
  const setStatus=(message,ok=false)=>{status.textContent=message;status.style.color=ok?'#80f0b4':'#8298a8'};
  const saveLocally=()=>{
    const key=readKey();
    if(!key){localStorage.removeItem('chronos-openrouter-key');setStatus('No key entered; local key cleared.');toast('OpenRouter key cleared from this browser.');return}
    if(modelSelect&&modelSelect.value==='none')modelSelect.value='openrouter';
    localStorage.setItem('chronos-openrouter-key',key);
    if(modelSelect)localStorage.setItem('chronos-provider',modelSelect.value||'openrouter');
    if(modelId)localStorage.setItem('chronos-model-id',modelId.value.trim()||'bytedance/seedance-2.0');
    if(visionModelId)localStorage.setItem('chronos-vision-model-id',visionModelId.value.trim()||'google/gemini-2.5-flash');
    if($('aiStatus'))$('aiStatus').textContent='OPENROUTER READY';
    setStatus('Saved locally on this device.',true);toast('OpenRouter key saved locally.');
  };
  const testKey=async()=>{
    const key=readKey();
    if(!key){setStatus('Enter an OpenRouter key first.');toast('Enter an OpenRouter API key to test.');return}
    test.disabled=true;save.disabled=true;setStatus('Testing key with OpenRouter…');
    try{
      const response=await fetch('https://openrouter.ai/api/v1/models',{method:'GET',headers:{Authorization:'Bearer '+key}});
      if(!response.ok){let detail='';try{const body=await response.json();detail=body.error?.message||body.message||''}catch(_){ }throw new Error(detail||('Request failed ('+response.status+').'))}
      const body=await response.json();
      const count=Array.isArray(body.data)?body.data.length:0;
      setStatus(count?('Key is valid · OpenRouter returned '+count+' models.'): 'Key is valid · OpenRouter responded successfully.',true);
      toast('OpenRouter key test passed.');
    }catch(error){
      setStatus('Key test failed: '+(error&&error.message?error.message:'Unable to reach OpenRouter.'));
      toast('OpenRouter key test failed.');
    }finally{test.disabled=false;save.disabled=false}
  };
  save.addEventListener('click',saveLocally);
  test.addEventListener('click',testKey);
  keyInput.addEventListener('input',()=>setStatus('Unsaved key changes.'));
})();
