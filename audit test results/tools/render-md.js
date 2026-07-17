const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

(async ()=>{
  const mdPath = path.resolve(process.cwd(),'ARCHITECTURE_SUBMISSION.md');
  let md = fs.readFileSync(mdPath,'utf8');

  // Replace first three mermaid blocks with image references to generated PNGs
  const images = [
    path.resolve(process.cwd(),'diagrams','architecture.png'),
    path.resolve(process.cwd(),'diagrams','auth-flow.png'),
    path.resolve(process.cwd(),'diagrams','data-flow.png')
  ];

  let imgIndex = 0;
  md = md.replace(/```mermaid[\s\S]*?```/g, ()=>{
    if(imgIndex >= images.length) return '';
    const p = images[imgIndex++];
    return `![](${p.replace(/\\/g,'/')})`;
  });

  const htmlBody = marked.parse(md);
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
  body{font-family: Arial, Helvetica, sans-serif; margin: 24px; color:#111}
  pre{background:#f7f7f7;padding:12px;border-radius:6px;overflow:auto}
  img{max-width:100%;height:auto}
  table{border-collapse:collapse}
  table, th, td{border:1px solid #ddd;padding:6px}
  </style></head><body>${htmlBody}</body></html>`;

  const tmpHtmlPath = path.resolve(process.cwd(),'_ARCH_DOC_TEMP.html');
  fs.writeFileSync(tmpHtmlPath, html, 'utf8');

  const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.goto('file:///' + tmpHtmlPath.replace(/\\/g,'/'));
  const outArg = process.argv[2] || 'ARCHITECTURE_SUBMISSION.pdf';
  await page.pdf({path: outArg, format: 'A4', printBackground:true});
  await browser.close();
  console.log('PDF generated:', outArg);
})();
