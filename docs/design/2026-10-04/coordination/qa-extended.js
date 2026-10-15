async(page)=>{
 for(const extra of page.context().pages())if(extra!==page)await extra.close();const checks=[],errors=[],out='/Users/tomek/1/repos/project_zenith/docs/design/2026-10-04/coordination';
 const check=(value,label)=>{if(!value)throw Error(label);checks.push(label)};
 const state=()=>page.evaluate(()=>{const l=JSON.parse(localStorage.getItem('zenith.coordination.v2'));return l.workspaces.find(w=>w.profile.id===l.activeId)});
 let lastNavigation=0;const go=async(name)=>{const remaining=450-(Date.now()-lastNavigation);if(remaining>0)await page.waitForTimeout(remaining);lastNavigation=Date.now();await page.getByRole('navigation',{name:'Views',exact:true}).getByRole('button',{name,exact:true}).click();await page.getByRole('heading',{name,exact:true,level:1}).waitFor();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))};
 const close=()=>page.getByRole('button',{name:'Close',exact:true}).click();
 const dismiss=async()=>{if(await page.getByRole('button',{name:'Dismiss notification'}).count())await page.getByRole('button',{name:'Dismiss notification'}).click()};
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:3107');await page.getByRole('button',{name:'Import',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles('/Users/tomek/1/repos/project_zenith/examples/coordination/worked-worlds.json');await page.getByRole('button',{name:'Open',exact:true}).click();await dismiss();
 check((await page.evaluate(()=>JSON.parse(localStorage.getItem('zenith.coordination.v2')))).workspaces.length===3,'downloadable three-world bundle imports through file control');
 const names=['Harbor','Meridian','Open Atlas'];
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const name of names){
  const current=(await state()).profile.name;await page.getByRole('button',{name:current,exact:true}).click();await page.locator('.profile-option').filter({hasText:name}).click();
  let w=await state();check(w.profile.name===name&&w.decisions.length===1&&w.outcomes.length>0,`${name} opens a complete worked team history`);
  await go('Ledger');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:`${out}/${w.profile.id}-ledger.png`});
  if(name==='Harbor'){
   await page.getByRole('button',{name:'Inspect Winter first decision'}).click();check(await page.getByRole('button',{name:'Print decision'}).isVisible(),'decision uses accessible print icon');
   await page.emulateMedia({media:'print'});check(await page.getByRole('dialog').isVisible()&&await page.locator('.z-workspace').isHidden(),'print media isolates frozen decision and ceilings');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:`${out}/decision-print.png`});await page.emulateMedia({media:'screen'});await close();
  }
  await page.getByRole('button',{name,exact:true}).click();await page.getByRole('button',{name:'New instance',exact:true}).click();await page.getByRole('button',{name:'Skip guide'}).click();
  for(const width of [1280,720,390,320]){
   await page.setViewportSize({width,height:width===1280?900:844});
   for(const view of ['Situation','Strategies','Mandates','Ledger']){
    await go(view);check(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),`${name} ${view} fits ${width}px`);
    check(await page.getByRole('button',{name:'About this world'}).isVisible(),`${name} information reachable at ${width}px ${view}`);
    if(name==='Harbor'&&width===1280&&['Situation','Strategies'].includes(view)){await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0)});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:`${out}/${view.toLowerCase()}.png`})}
    if(name==='Harbor'&&width===390&&view==='Strategies'){await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0)});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:`${out}/strategies-mobile.png`});check(await page.locator('.z-decision-bar').evaluate(e=>e.getBoundingClientRect().height)<70,'phone decision control remains one compact row')}
   }
  }
 }
 await page.setViewportSize({width:1280,height:900});await go('Strategies');
 await page.getByRole('link',{name:'Skip to content'}).focus();await page.keyboard.press('Enter');check(await page.getByRole('heading',{name:'Strategies',exact:true,level:1}).isVisible(),'keyboard skip link preserves selected view');
 await page.getByRole('button',{name:'About this world'}).click();await page.keyboard.press('Shift+Tab');check(await page.evaluate(()=>Boolean(document.activeElement?.closest('[role=dialog]'))),'inspector traps keyboard focus');await page.keyboard.press('Escape');check(await page.getByRole('dialog').count()===0,'keyboard dismisses inspector');
 const active=(await state()).profile.name;await page.getByRole('button',{name:active,exact:true}).click();await page.getByRole('button',{name:'New world',exact:true}).click();await page.getByRole('textbox',{name:'Name',exact:true}).fill('Emission reduction');await page.getByRole('textbox',{name:'Objective',exact:true}).fill('Reduce embodied emissions');await page.getByText('Model',{exact:true}).click();await page.getByRole('textbox',{name:'Unit',exact:true}).fill('kg CO₂e');await page.getByRole('spinbutton',{name:'Baseline'}).fill('100');await page.getByRole('spinbutton',{name:'Target'}).fill('70');await page.getByRole('button',{name:'Create',exact:true}).click();
 let w=await state();check(w.profile.objectives[0].unit==='kg CO₂e'&&w.profile.objectives[0].direction==='decrease'&&w.profile.interventions[0].effects[0].amount===-10,'custom onboarding configures units and a decreasing objective');await page.getByRole('button',{name:'Skip guide'}).click();
 await page.getByRole('button',{name:/Assumed Committed time/}).click();
 const other=await page.context().newPage();await other.goto('http://127.0.0.1:3107');await other.getByRole('button',{name:'Time commitment reduced',exact:true}).click();
 await page.getByRole('button',{name:'Reload source'}).waitFor();check(await page.getByRole('button',{name:'Revise',exact:true}).isDisabled(),'concurrent source revision cannot be overwritten by stale input');await page.getByRole('button',{name:'Reload source'}).click();check(await page.getByRole('spinbutton').inputValue()==='60','source reload uses the latest confirmed value');await close();
 await other.getByRole('banner').getByRole('button',{name:'Emission reduction',exact:true}).click();await other.locator('.profile-option').filter({hasText:'Meridian'}).filter({hasNotText:'new instance'}).click();await page.getByRole('button',{name:'Meridian',exact:true}).waitFor();check((await state()).profile.id==='meridian','cross-tab world selection refreshes context');await other.close();await dismiss();
 await page.getByRole('button',{name:'Export',exact:true}).click();await page.getByRole('button',{name:'Current world',exact:true}).click();await page.getByText('JSON',{exact:true}).click();const single=JSON.parse(await page.getByRole('textbox',{name:'Export JSON'}).inputValue());check(single.payload.workspaces.length===1&&single.payload.activeId==='meridian','single-world export remains a valid independent library');await close();
 await page.getByRole('button',{name:'Meridian',exact:true}).click();await page.getByRole('button',{name:'Archive',exact:true}).click();const dl=page.waitForEvent('download');await page.getByRole('button',{name:'zenith.coordination.v2.previous',exact:true}).click();await(await dl).saveAs('/private/tmp/zenith-coordination-qa/backup.json');await close();
 await page.getByRole('button',{name:'Import',exact:true}).click();await page.locator('input[type=file]').setInputFiles('/private/tmp/zenith-coordination-qa/backup.json');await page.getByRole('button',{name:'Open',exact:true}).click();check(await page.getByRole('dialog').count()===0,'downloaded recovery library can be reopened normally');await dismiss();
 await page.evaluate(()=>localStorage.setItem('zenith.coordination.v2','{broken'));await page.reload();await page.getByRole('heading',{name:'Choose your world.'}).waitFor();await page.getByRole('button',{name:'Begin',exact:true}).click();check(await page.evaluate(()=>localStorage.getItem('zenith.coordination.v2'))==='{broken','corrupt stored data is not silently replaced during onboarding');await page.getByRole('button',{name:'Recover workspace'}).click();await page.getByRole('textbox',{name:'Workspace JSON'}).fill(JSON.stringify(single));await page.getByRole('button',{name:'Validate',exact:true}).click();await page.getByRole('button',{name:'Open'}).click();await dismiss();check((await state()).profile.id==='meridian','recovery restores validated library after corruption');
 check(await page.locator('.z-content').evaluate(e=>parseFloat(getComputedStyle(e).animationDuration)<.01),'reduced motion disables view movement');check(errors.length===0,'no browser application errors across extended flows');
 await go('Situation');return {passed:checks.length,checks,errors,captures:out};
}
