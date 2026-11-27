const fs = require('fs');
const path = require('path');

// 1. Patch backend main.js with /api/industry-template
try {
  const possiblePaths = [
    '/app/packages/twenty-server/dist/main.js',
    path.join(__dirname, '../twenty-server/dist/main.js'),
    path.join(process.cwd(), 'dist/main.js'),
    path.join(process.cwd(), 'packages/twenty-server/dist/main.js'),
  ];
  const mainPath = possiblePaths.find(p => fs.existsSync(p));

  if (!mainPath) {
    console.warn('[Patch] Could not find dist/main.js; skipping backend patching.');
  } else {
    let c = fs.readFileSync(mainPath, 'utf8');
    const listenStr = "await app.listen(twentyConfigService.get('NODE_PORT'));";
    const listenIdx = c.indexOf(listenStr);

    if (listenIdx === -1) {
      console.warn('[Patch] Could not find app.listen in ' + mainPath + '; skipping backend patch.');
    } else {
      const newBlock = `app.getHttpAdapter().getInstance().post('/api/industry-template', async (req, res) => {
        const industry = req.body?.industry || 'healthcare';
        const workspaceId = req.body?.workspaceId;
        console.log('[API] /api/industry-template called with industry:', industry, 'workspaceId:', workspaceId);
        try {
            if (industry === 'manufacturing') {
                try { delete require.cache[require.resolve('/app/provision-complete-manufacturing-workspace.cjs')]; } catch(e){}
                const { provisionManufacturingModules } = require('/app/provision-complete-manufacturing-workspace.cjs');
                const result = await provisionManufacturingModules(app, workspaceId, { isOnboardingTemplate: true });
                res.json({ success: true, industry, result, message: 'Successfully applied Manufacturing CRM template' });
                return;
            }
            if (industry === 'healthcare') {
                try { delete require.cache[require.resolve('/app/provision-complete-healthcare-workspace.cjs')]; } catch(e){}
                const { provisionHealthcareModules } = require('/app/provision-complete-healthcare-workspace.cjs');
                const result = await provisionHealthcareModules(app, workspaceId, { isOnboardingTemplate: true });
                res.json({ success: true, industry, result, message: 'Successfully applied Healthcare CRM template' });
                return;
            }
            try { delete require.cache[require.resolve('/app/apply-industry-logic.cjs')]; } catch(e){}
            try { delete require.cache[require.resolve('/app/provision-complete-realestate-workspace.cjs')]; } catch(e){}
            const { applyIndustry } = require('/app/apply-industry-logic.cjs');
            const updatedWsIds = await applyIndustry(industry, workspaceId);
            try {
                const { WorkspaceCacheService } = require('./engine/workspace-cache/services/workspace-cache.service');
                const cacheService = app.get(WorkspaceCacheService);
                const idsToEvict = Array.from(new Set([...(Array.isArray(updatedWsIds) ? updatedWsIds : []), ...(workspaceId ? [workspaceId] : [])]));
                if (cacheService) {
                    for (const id of idsToEvict) {
                        await cacheService.evictWorkspaceFromLocalCache(id);
                        console.log('[API] Evicted local cache for workspace:', id);
                    }
                }
            } catch(ce) {
                console.warn('[API] Cache eviction notice:', ce.message);
            }
            res.json({ success: true, industry, message: 'Successfully applied ' + industry + ' template' });
            return;
        } catch (err) {
            console.error('[API] Error applying industry template:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });
    app.getHttpAdapter().getInstance().post('/api/healthcare/provision', async (req, res) => {
        const workspaceId = req.body?.workspaceId;
        const isOnboardingTemplate = req.body?.isOnboardingTemplate !== false;
        console.log('[API] /api/healthcare/provision called with workspaceId:', workspaceId, 'isOnboardingTemplate:', isOnboardingTemplate);
        try {
            try { delete require.cache[require.resolve('/app/provision-complete-healthcare-workspace.cjs')]; } catch(e){}
            const { provisionHealthcareModules } = require('/app/provision-complete-healthcare-workspace.cjs');
            const result = await provisionHealthcareModules(app, workspaceId, { isOnboardingTemplate });
            res.json({ success: true, result });
            return;
        } catch (err) {
            console.error('[API] Error provisioning Healthcare CRM:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });
    app.getHttpAdapter().getInstance().post('/api/manufacturing/provision', async (req, res) => {
        const workspaceId = req.body?.workspaceId;
        const isOnboardingTemplate = req.body?.isOnboardingTemplate === true;
        console.log('[API] /api/manufacturing/provision called with workspaceId:', workspaceId, 'isOnboardingTemplate:', isOnboardingTemplate);
        try {
            try { delete require.cache[require.resolve('/app/provision-complete-manufacturing-workspace.cjs')]; } catch(e){}
            const { provisionManufacturingModules } = require('/app/provision-complete-manufacturing-workspace.cjs');
            const result = await provisionManufacturingModules(app, workspaceId, { isOnboardingTemplate });
            res.json({ success: true, result });
            return;
        } catch (err) {
            console.error('[API] Error provisioning Manufacturing CRM:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });
    `;

      const existingIdx = c.indexOf("app.getHttpAdapter().getInstance().post('/api/industry-template'");
      if (existingIdx !== -1 && existingIdx < listenIdx) {
        c = c.substring(0, existingIdx) + newBlock + c.substring(listenIdx);
      } else {
        c = c.substring(0, listenIdx) + newBlock + c.substring(listenIdx);
      }

      fs.writeFileSync(mainPath, c, 'utf8');
      console.log('Successfully patched ' + mainPath + ' with /api/industry-template!');
    }
  }
} catch (err) {
  console.warn('[Patch] Non-fatal notice during backend patch:', err.message);
}

// 2. Copy industry card images into dist/front/assets
try {
  const possibleFrontDirs = [
    '/app/packages/twenty-server/dist/front/assets',
    path.join(__dirname, '../twenty-server/dist/front/assets'),
    path.join(process.cwd(), 'dist/front/assets'),
    path.join(process.cwd(), 'packages/twenty-server/dist/front/assets'),
  ];
  const frontAssetsDir = possibleFrontDirs.find(d => fs.existsSync(d));

  const possibleSrcDirs = [
    '/app/industry-assets',
    path.join(__dirname, '../twenty-front/src/assets'),
    path.join(process.cwd(), 'packages/twenty-front/src/assets'),
  ];
  const srcAssetsDir = possibleSrcDirs.find(d => fs.existsSync(d));

  if (srcAssetsDir && frontAssetsDir) {
    for (const file of fs.readdirSync(srcAssetsDir)) {
      const src = path.join(srcAssetsDir, file);
      const dst = path.join(frontAssetsDir, file);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, dst);
      }
    }
    console.log('Copied industry assets to front/assets!');
  }

  // 3. Patch CreateProfile frontend bundle to show industry selector cards and call /api/industry-template
  if (frontAssetsDir && fs.existsSync(frontAssetsDir)) {
    const cpFile = fs.readdirSync(frontAssetsDir).find(f => f.startsWith('CreateProfile-') && f.endsWith('.js'));
    if (cpFile) {
      const cpPath = path.join(frontAssetsDir, cpFile);
      let code = fs.readFileSync(cpPath, 'utf8');
      if (!code.includes('/api/industry-template')) {
        const stateTarget = '[l,o]=(0,S.useState)(!1),';
        const submitTarget = 'j(t=>w(t)?{...t,firstName:r.firstName,lastName:r.lastName}:t),b("createProfile",';
        const depsTarget = '[a?.id,f,N,b,h,u,j,g]';
        const formEndTarget = 'onChange:r,placeholder:s._({id:"w3CVxK"}),fullWidth:!0})})]})}),(0,e.jsx)(y,{index:3';

        if (code.includes(stateTarget) && code.includes(submitTarget) && code.includes(depsTarget) && code.includes(formEndTarget)) {
          code = code.replace(
            stateTarget,
            '[l,o]=(0,S.useState)(!1),[selectedIndustry,setSelectedIndustry]=(0,S.useState)(null),'
          );
          code = code.replace(
            submitTarget,
            'j(t=>w(t)?{...t,firstName:r.firstName,lastName:r.lastName}:t),selectedIndustry&&(await fetch("/api/industry-template",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({industry:selectedIndustry,workspaceId:a?.workspaceId})}).catch(err=>console.error("Failed to apply industry template",err)),window.location.href="/"),b("createProfile",'
          );
          code = code.replace(
            depsTarget,
            '[a?.id,a?.workspaceId,f,N,b,h,u,j,g,selectedIndustry]'
          );
          const cardsJsx =
            ',(0,e.jsxs)("div",{style:{display:"flex",flexDirection:"column",gap:"8px",marginTop:"16px",width:"100%"},children:[' +
            '(0,e.jsx)("div",{style:{fontSize:"12px",fontWeight:500,color:"#666"},children:"Select Your Industry CRM Template"}),' +
            '(0,e.jsx)("div",{style:{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:"12px",width:"100%"},children:[' +
            '{id:"manufacturing",title:"Manufacturing CRM",description:"Products, Production Orders, Raw Materials, Suppliers, Inventory, and Quality Control.",img:"/assets/image-10.png"},' +
            '{id:"healthcare",title:"Healthcare CRM",description:"Patients, Appointments, Doctors, Departments, Follow-ups, and Reports.",img:"/assets/healthcare.jpg"},' +
            '{id:"realestate",title:"Real Estate CRM",description:"Property Listings, Buyers & Leads, Site Visits, Deals, Follow-ups, and Reports.",img:"/assets/realestate.png"},' +
            '{id:"others",title:"Others",description:"Lead, Opportunity, Contact, Company, and Task.",img:"/assets/images.png"}' +
            '].map(card=>(0,e.jsxs)("div",{onClick:()=>{if(l||Q)return;setSelectedIndustry(card.id)},style:{display:"flex",alignItems:"center",gap:"12px",padding:"12px 16px",borderRadius:"8px",cursor:(l||Q)?"not-allowed":"pointer",pointerEvents:(l||Q)?"none":"auto",opacity:(l||Q)&&selectedIndustry!==card.id?0.35:1,boxSizing:"border-box",userSelect:"none",transition:"all 0.15s ease-in-out",backgroundColor:selectedIndustry===card.id?"#f5f7ff":"#ffffff",border:selectedIndustry===card.id?"2px solid #2563eb":"1px solid #e5e7eb",boxShadow:selectedIndustry===card.id?"0 0 0 3px rgba(37, 99, 235, 0.15)":"0 2px 8px rgba(0, 0, 0, 0.04)"},children:[' +
            '(0,e.jsx)("img",{src:card.img,alt:card.title,style:{width:"48px",height:"48px",borderRadius:"6px",objectFit:"cover",flexShrink:0}}),' +
            '(0,e.jsxs)("div",{style:{display:"flex",flexDirection:"column",gap:"4px"},children:[' +
            '(0,e.jsx)("span",{style:{fontSize:"13px",fontWeight:600,color:"#111"},children:card.title}),' +
            '(0,e.jsx)("span",{style:{fontSize:"11px",color:"#666",lineHeight:"1.3"},children:card.description})' +
            ']})' +
            ']},card.id))})' +
            ']})';
          code = code.replace(
            formEndTarget,
            'onChange:r,placeholder:s._({id:"w3CVxK"}),fullWidth:!0})})' + cardsJsx + ']})}),(0,e.jsx)(y,{index:3'
          );
          if (code.includes('disabled:!z||Q||l')) {
            code = code.replace('disabled:!z||Q||l', 'disabled:!selectedIndustry||Q||l,isLoading:l||Q');
          }
          fs.writeFileSync(cpPath, code, 'utf8');
          console.log('Successfully patched ' + cpFile + ' with Industry Selector cards!');
        } else {
          console.warn('CreateProfile bundle anchors did not match; skipping frontend patch.');
        }
      } else {
        let updated = false;
        if (code.includes('window.location.reload()')) {
          code = code.replace(/window\.location\.reload\(\)/g, 'window.location.href="/"');
          updated = true;
        }
        if (code.includes('setTimeout(()=>window.location.reload(),500)')) {
          code = code.replace('setTimeout(()=>window.location.reload(),500)', 'window.location.href="/"');
          updated = true;
        }
        if (code.includes('onClick:()=>setSelectedIndustry(card.id)')) {
          code = code.replace('onClick:()=>setSelectedIndustry(card.id)', 'onClick:()=>{if(l||Q)return;setSelectedIndustry(card.id)}');
          updated = true;
        }
        if (code.includes('cursor:"pointer",boxSizing')) {
          code = code.replace('cursor:"pointer",boxSizing', 'cursor:(l||Q)?"not-allowed":"pointer",pointerEvents:(l||Q)?"none":"auto",opacity:(l||Q)&&selectedIndustry!==card.id?0.35:1,boxSizing');
          updated = true;
        }
        if (code.includes('disabled:!selectedIndustry||Q||l,onClick')) {
          code = code.replace('disabled:!selectedIndustry||Q||l,onClick', 'disabled:!selectedIndustry||Q||l,isLoading:l||Q,onClick');
          updated = true;
        }
        if (code.includes('label:s._({id:"xGVfLh"})')) {
          code = code.replace('label:s._({id:"xGVfLh"})', 'label:(l||Q)?("Setting up "+(selectedIndustry==="manufacturing"?"Manufacturing":selectedIndustry==="healthcare"?"Healthcare":selectedIndustry==="realestate"?"Real Estate":"Custom")+" CRM..."):s._({id:"xGVfLh"})');
          updated = true;
        }
        if (code.includes('disabled:!z||Q||l')) {
          code = code.replace('disabled:!z||Q||l', 'disabled:!selectedIndustry||Q||l,isLoading:l||Q');
          updated = true;
        }
        // Remove any invalid useEffect hooks in const declaration
        if (code.includes('useEffect')) {
          const cleaned = code.replace(/,\(0,S\.useEffect\)\(\(\)=>\{if\(a\?\.name\?\.firstName\)\{window\.location\.href="\/"[;]?\}\},\[a\?\.name\?\.firstName\]\);?/g, ',');
          if (cleaned !== code) {
            code = cleaned;
            updated = true;
          }
        }
        if (updated) {
          fs.writeFileSync(cpPath, code, 'utf8');
          console.log('Updated ' + cpFile + ' with direct navigation to CRM root!');
        } else {
          console.log('CreateProfile bundle already patched.');
        }
      }
    }
  }
} catch (err) {
  console.warn('[Patch] Non-fatal notice during frontend patch:', err.message);
}
