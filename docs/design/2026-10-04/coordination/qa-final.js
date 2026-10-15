async(page)=>{
 const checks=[],errors=[],out='/Users/tomek/1/repos/project_zenith/docs/design/2026-10-04/coordination';
 const check=(value,label)=>{if(!value)throw Error(label);checks.push(label)};
 const library=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('zenith.coordination.v2')));
 const state=async()=>{const l=await library();return l.workspaces.find(w=>w.profile.id===l.activeId)};
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const dismiss=async()=>{if(await page.getByRole('button',{name:'Dismiss notification'}).count())await page.getByRole('button',{name:'Dismiss notification'}).click()};
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:3107');await page.evaluate(()=>localStorage.removeItem('zenith.coordination.v2'));await page.reload();await page.getByRole('heading',{name:'Choose your world.'}).waitFor();await page.emulateMedia({reducedMotion:'reduce'});await settle();
 check(await page.getByRole('button',{name:'Import',exact:true}).isVisible(),'first-run onboarding exposes import');await page.screenshot({path:`${out}/onboarding.png`});
 await page.getByRole('button',{name:'Import',exact:true}).click();await page.locator('input[type=file]').setInputFiles('/Users/tomek/1/repos/project_zenith/examples/coordination/harbor.profile.json');await page.getByRole('button',{name:'Open',exact:true}).click();await dismiss();
 check((await state()).profile.id==='harbor'&&(await state()).decisions.length===0,'first-run profile file import opens fresh world');
 check(await page.getByRole('button',{name:'Skip guide'}).isVisible(),'fresh imported profile enters onboarding guide');await page.getByRole('button',{name:'Skip guide'}).click();
 for(const name of ['Harbor','Meridian','Open Atlas']){
   if((await state()).profile.name!==name){await page.getByRole('banner').getByRole('button',{name:(await state()).profile.name,exact:true}).click();await page.locator('.profile-option').filter({hasText:name}).click();}
   await page.getByRole('navigation',{name:'Views',exact:true}).getByRole('button',{name:'Situation',exact:true}).click();await settle();
   const w=await state();const expected=[...new Set(w.profile.scopes.flatMap(s=>s.relatedIds.map(id=>[s.id,id].sort().join('|'))))].sort();const actual=(await page.locator('[data-overlap]').evaluateAll(elements=>elements.map(e=>e.getAttribute('data-overlap')))).sort();
   check(JSON.stringify(expected)===JSON.stringify(actual),`${name} scope map draws every declared overlap once`);
   if(name==='Harbor')await page.screenshot({path:`${out}/situation.png`});
 }
 await page.getByRole('banner').getByRole('button',{name:'Open Atlas',exact:true}).click();await page.getByRole('button',{name:'New world',exact:true}).click();await page.getByRole('textbox',{name:'Name',exact:true}).fill('Continuity check');await page.getByRole('textbox',{name:'Objective',exact:true}).fill('Protect existing work');await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByRole('button',{name:'Skip guide'}).click();
 const before=await state();await page.evaluate(()=>{const l=JSON.parse(localStorage.getItem('zenith.coordination.v2'));l.activeId=null;localStorage.setItem('zenith.coordination.v2',JSON.stringify(l))});await page.reload();await page.getByRole('heading',{name:'Choose your world.'}).waitFor();await page.getByRole('button').filter({has:page.getByRole('heading',{name:'Continuity check'})}).click();
 check(await page.getByRole('button',{name:'Open',exact:true}).isVisible()&&await page.getByRole('button',{name:'Worked case',exact:true}).count()===0,'unselected existing library has one custom world reopening action');await page.getByRole('button',{name:'Open',exact:true}).click();
 check(JSON.stringify(await state())===JSON.stringify(before),'existing world reopening preserves state and history');
 await page.getByRole('button',{name:'Export',exact:true}).click();await page.getByRole('button',{name:'Current world',exact:true}).click();await page.getByText('JSON',{exact:true}).click();const saved=await page.getByRole('textbox',{name:'Export JSON'}).inputValue();await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.evaluate(()=>localStorage.setItem('zenith.coordination.v2','{broken'));await page.reload();await page.getByRole('button',{name:'Recover workspace'}).click();await page.getByRole('textbox',{name:'Workspace JSON'}).fill(saved);await page.getByRole('button',{name:'Validate',exact:true}).click();await page.getByRole('button',{name:'Open',exact:true}).click();await dismiss();
 check((await state()).profile.id===before.profile.id,'first-run recovery validates and restores world');
 check(await page.evaluate(()=>localStorage.getItem('zenith.coordination.v2.previous'))==='{broken','recovery archives original corrupt bytes');
 check(errors.length===0,'no application errors in final onboarding and graph checks');return {passed:checks.length,checks,errors};
}
