const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function render(inputPath, outputPath) {
  const code = fs.readFileSync(inputPath, 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script><style>body{margin:0;padding:20px;background:#fff}</style></head><body><div class="mermaid">${code}</div><script>mermaid.initialize({startOnLoad:true});</script></body></html>`;
  const tmp = path.resolve(path.dirname(outputPath), '__tmp_mermaid.html');
  fs.writeFileSync(tmp, html, 'utf8');
  const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.goto('file:///' + tmp.replace(/\\/g,'/'));
  await page.waitForSelector('.mermaid');
  // wait for mermaid to render
  await page.waitForFunction(() => {
    const el = document.querySelector('.mermaid');
    return el && (el.innerHTML.trim().length>0);
  }, {timeout:5000}).catch(()=>{});
  const el = await page.$('.mermaid');
  const rect = await el.boundingBox();
  await page.screenshot({path: outputPath, clip:{x:rect.x, y:rect.y, width:Math.ceil(rect.width), height:Math.ceil(rect.height)}});
  await browser.close();
}

(async ()=>{
  const files = [
    ['diagrams/architecture.mmd','diagrams/architecture.png'],
    ['diagrams/auth-flow.mmd','diagrams/auth-flow.png'],
    ['diagrams/data-flow.mmd','diagrams/data-flow.png']
  ];
  for(const [inF,outF] of files){
    console.log('Rendering', inF, '->', outF);
    await render(inF,outF);
    console.log('Wrote', outF);
  }
})();
