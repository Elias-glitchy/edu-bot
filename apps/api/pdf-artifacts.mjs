const PAGE_WIDTH=595,PAGE_HEIGHT=842,MARGIN=48,CONTENT_WIDTH=PAGE_WIDTH-MARGIN*2;

const ascii=value=>String(value??'').normalize('NFKD').replace(/[^\x20-\x7E]/g,' ').replace(/\s+/g,' ').trim();
const escapePdf=value=>ascii(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');

function wrap(text,size=10,bold=false){
  const average=size*(bold?.57:.52),limit=Math.max(18,Math.floor(CONTENT_WIDTH/average)),words=ascii(text).split(' ').filter(Boolean),lines=[];let line='';
  for(const word of words){const next=line?`${line} ${word}`:word;if(next.length>limit&&line){lines.push(line);line=word;}else line=next;}
  if(line)lines.push(line);return lines.length?lines:[''];
}

function paginate(blocks){
  const pages=[];let page=[],y=PAGE_HEIGHT-62;
  const nextPage=()=>{if(page.length)pages.push(page);page=[];y=PAGE_HEIGHT-62;};
  for(const block of blocks){
    if(block.pageBreak){nextPage();continue;}
    const size=block.size||10,leading=block.leading||size*1.45,lines=wrap(block.text,size,block.bold);
    const needed=lines.length*leading+(block.before||0)+(block.after||0);if(y-needed<54&&page.length)nextPage();
    y-=block.before||0;
    for(const line of lines){page.push({...block,text:line,y});y-=leading;}
    y-=block.after||0;
  }
  nextPage();return pages;
}

export function createStyledPdf({title,subtitle='',blocks=[]}){
  const pages=paginate([{text:'EDU BOT | MELSOFT ACADEMY HACKATHON',size:8,bold:true,color:'gold',after:12},{text:title,size:22,bold:true,after:5},...(subtitle?[{text:subtitle,size:10,color:'muted',after:15}]:[]),...blocks]);
  const pageCount=pages.length,fontRegular=3+pageCount*2,fontBold=fontRegular+1,objects=[];
  objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
  objects[2]=`<< /Type /Pages /Kids [${pages.map((_,index)=>`${3+index*2} 0 R`).join(' ')}] /Count ${pageCount} >>`;
  pages.forEach((lines,index)=>{
    const pageId=3+index*2,contentId=pageId+1,commands=['0.055 0.059 0.067 rg','0 0 595 842 re f','0.90 0.64 0.16 RG','48 806 m 547 806 l S'];
    for(const line of lines){const color=line.color==='gold'?'0.95 0.67 0.18':line.color==='muted'?'0.69 0.72 0.77':'0.97 0.97 0.98',font=line.bold?'F2':'F1';commands.push(`BT /${font} ${line.size||10} Tf ${color} rg 1 0 0 1 ${MARGIN} ${line.y.toFixed(1)} Tm (${escapePdf(line.text)}) Tj ET`);}
    commands.push(`BT /F1 8 Tf 0.55 0.58 0.63 rg 1 0 0 1 48 28 Tm (Fictional demonstration data - Educator review required) Tj ET`,`BT /F2 8 Tf 0.90 0.64 0.16 rg 1 0 0 1 505 28 Tm (${index+1} / ${pageCount}) Tj ET`);
    const stream=commands.join('\n');objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`;objects[contentId]=`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontRegular]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';objects[fontBold]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  let output='%PDF-1.4\n%EDUBOT\n',offsets=[0];
  for(let id=1;id<objects.length;id++){offsets[id]=Buffer.byteLength(output);output+=`${id} 0 obj\n${objects[id]}\nendobj\n`;}
  const xref=Buffer.byteLength(output);output+=`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(value=>`${String(value).padStart(10,'0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output,'ascii');
}

export function createMarkedPapersPdf({missionId,rubric,assessments,assignments,findings=[]}){
  const assignmentByStudent=new Map(assignments.map(item=>[item.studentId,item])),findingByStudent=new Map(findings.map(item=>[item.student_id,item])),blocks=[
    {text:'VERIFIED MARKING BUNDLE',size:11,bold:true,color:'gold',after:8},
    {text:`Mission receipt: ${missionId}`,size:9,color:'muted',after:12},
    {text:`${assessments.length} fictional submissions were assessed against ${rubric.title}. Numeric totals were independently recalculated by Academic QA before this bundle was produced.`,size:11,after:12},
    {text:'Workflow evidence',size:14,bold:true,before:4,after:7},
    {text:'1. CHIEF delegated the controlled assessment workflow.',size:10,after:3},
    {text:'2. Assessment & Grading produced criterion-level drafts and feedback.',size:10,after:3},
    {text:'3. Academic QA detected the planted mismatch, requested correction and independently verified the revision.',size:10,after:3},
    {text:'4. The lecturer remains the final decision-maker before any record update.',size:10,after:10},
    {text:`Rubric maximum: ${rubric.maximum_points} points | Criteria: ${rubric.criteria.length} | QA findings corrected: ${findings.length}`,size:10,bold:true,color:'gold'}
  ];
  for(const assessment of assessments){
    const assignment=assignmentByStudent.get(assessment.student_id),scores=JSON.parse(assessment.criterion_scores),finding=findingByStudent.get(assessment.student_id);blocks.push({pageBreak:true},{text:`MARKED PAPER - ${assessment.student_id}`,size:18,bold:true,after:4},{text:assignment?.name||'Fictional learner',size:11,color:'gold',after:10},{text:'Original submission',size:13,bold:true,after:6},{text:assignment?.submission||'Submission text unavailable.',size:10,after:14},{text:'Verified rubric assessment',size:13,bold:true,after:7});
    for(const score of scores){const criterion=rubric.criteria.find(item=>item.key===score.key);blocks.push({text:`${criterion?.title||score.key}: ${score.points}/${score.max_points}`,size:10,bold:true,color:'gold',after:2},{text:`Evidence: ${score.evidence}`,size:9,color:'muted',after:6});}
    blocks.push({text:`VERIFIED TOTAL: ${assessment.derived_total}/${rubric.maximum_points}`,size:15,bold:true,before:5,after:8});
    if(finding)blocks.push({text:`QA correction: claimed ${finding.observed}; independently recalculated ${finding.expected}. A versioned correction was created and verified.`,size:9,bold:true,color:'gold',after:8});
    blocks.push({text:'Draft educator feedback',size:12,bold:true,after:4},{text:assessment.feedback,size:10,after:10},{text:`Status: VERIFIED DRAFT | Revision: ${assessment.revision} | Source retained in EDU BOT`,size:9,color:'muted'});
  }
  return createStyledPdf({title:'Corrected Marked Papers',subtitle:'Academic QA verified assessment evidence and feedback',blocks});
}
