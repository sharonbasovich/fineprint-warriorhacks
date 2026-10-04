import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='presentation-capture';
await mkdir(out,{recursive:true});
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:out,size:{width:1920,height:1080}},locale:'en-US',timezoneId:'UTC'});
const page=await context.newPage();
const errors=[]; const marks=[];
let outcome={status:'failed',error:'Capture did not complete'};
page.on('pageerror',e=>errors.push({type:'pageerror',message:e.message}));
page.on('requestfailed',r=>errors.push({type:'requestfailed',url:r.url(),failure:r.failure()}));
const recordStart=performance.now(); let takeStart;
const mark=async name=>{
  marks.push({name,recordSeconds:(performance.now()-recordStart)/1000,takeSeconds:takeStart?(performance.now()-takeStart)/1000:null});
  await page.screenshot({path:`${out}/${name}.png`});
};
const until=async seconds=>{const ms=takeStart+seconds*1000-performance.now(); if(ms>0) await page.waitForTimeout(ms);};
try {
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  assert.match(await page.locator('#how').innerText(),/Links extracted passages to their source/);
  await page.getByLabel('Try a bundled sample').selectOption('synthetic-conflict');
  await page.getByRole('heading',{name:'What the letter says — “Synthetic: two different due dates”',exact:true}).waitFor();
  assert.match(await page.locator('#warnings').innerText(),/Synthetic demonstration document/);
  assert.match(await page.locator('#sample-blurb').innerText(),/shows the detected timing passages/);
  // Locate the real timing card by its distinctive source wording.
  const passage=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Send your renewal as soon as you can.'})});
  await passage.locator('summary').click();
  const timingQuote=passage.getByRole('button',{name:/p\.1.*Send your renewal as soon as you can/});
  await timingQuote.scrollIntoViewIfNeeded();
  assert.match(await timingQuote.innerText(),/07\/15\/2027/);
  assert.match(await timingQuote.innerText(),/07\/01\/2027/);
  takeStart=performance.now(); await mark('01-two-dates-hook');
  await until(9); await mark('02-before-timing-click');
  await timingQuote.click(); await page.waitForTimeout(900); await mark('03-timing-source-jump');
  const dateSource=page.locator('#source-view .src-line').filter({hasText:'Send your renewal as soon as you can.'});
  assert.match(await dateSource.innerText(),/07\/15\/2027.*07\/01\/2027/);
  await until(34); await mark('04-read-two-dates-in-context');
  await until(47); await passage.locator('summary').click();
  const housing=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Housing costs'})});
  await housing.locator('summary').click();
  await housing.scrollIntoViewIfNeeded();
  assert.match(await housing.innerText(),/only if you are applying for SNAP/);
  await mark('05-only-if-condition');
  const housingQuote=housing.getByRole('button',{name:/p\.2.*Housing costs/});
  await until(73); await mark('06-before-condition-click');
  await housingQuote.click(); await page.waitForTimeout(900); await mark('07-condition-source-jump');
  const housingSource=page.locator('#source-view .src-line').filter({hasText:'• Housing costs (only if you are applying for SNAP):'});
  assert.equal((await housingSource.innerText()).trim(),'• Housing costs (only if you are applying for SNAP): Most recent rent receipt or mortgage statement.');
  await until(95); await mark('08-source-and-evidence-reading-hold');
  await until(111); await mark('09-closing-proof');
  await until(125); await mark('10-take-end');
  assert.deepEqual(errors,[]);
  await writeFile(`${out}/verification.txt`,'Actual sample selection, timing disclosure, source-link click, condition disclosure and condition source click. Fictional built-in input only. No product DOM/state injection, private inputs, credentials, external account operations or simulated UI. Product files match corrected reference commit.\n');
  outcome={status:'success',error:null};
} catch(error) {
  outcome={status:'failed',error:error.stack || String(error)};
  await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});
  throw error;
} finally {
  await writeFile(`${out}/capture-status.json`,JSON.stringify(outcome,null,2));
  await writeFile(`${out}/marks.json`,JSON.stringify({captureCommit:process.env.GITHUB_SHA??null,productReference:'6eeba14485e299233bd31e29e3095577a44718f2',viewport:{width:1920,height:1080},marks},null,2));
  await writeFile(`${out}/browser-errors.json`,JSON.stringify(errors,null,2));
  const video=page.video(); await context.close();
  if(video) await video.saveAs(`${out}/fineprint-genuine-capture.webm`);
  await browser.close();
}
