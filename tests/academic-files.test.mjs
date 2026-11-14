import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { extractAcademicText, parseCsv } from '../apps/api/academic-files.mjs';

function minimalZipEntry(target,xmlText){
  const name=Buffer.from(target),xml=Buffer.from(xmlText),compressed=deflateRawSync(xml),header=Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(8,8);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(xml.length,22);header.writeUInt16LE(name.length,26);
  return Buffer.concat([header,name,compressed]);
}
const minimalDocx=text=>minimalZipEntry('word/document.xml',`<w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);

test('academic extraction validates TXT, CSV, JSON, PDF and Office content',()=>{
  assert.equal(extractAcademicText('assignment.txt',Buffer.from('Student ID: STU-001')),'Student ID: STU-001');
  assert.equal(parseCsv('student_id,name\nSTU-001,"Amina, J"\n')[0].name,'Amina, J');
  assert.match(extractAcademicText('rubric.json',Buffer.from('{"maximum_points":100}')),/maximum_points/);
  assert.match(extractAcademicText('sample.pdf',Buffer.from('%PDF-1.4\nstream\nBT (Academic evidence) Tj ET\nendstream\n%%EOF')),/Academic evidence/);
  assert.match(extractAcademicText('sample.docx',minimalDocx('Curriculum outcome')),/Curriculum outcome/);
  assert.match(extractAcademicText('slides.pptx',minimalZipEntry('ppt/slides/slide1.xml','<p:sld><a:p><a:r><a:t>Lecture topic</a:t></a:r></a:p></p:sld>')),/Lecture topic/);
  assert.match(extractAcademicText('grades.xlsx',minimalZipEntry('xl/worksheets/sheet1.xml','<worksheet><sheetData><row><c><v>82</v></c></row></sheetData></worksheet>')),/82/);
  assert.equal(extractAcademicText('photo.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')),'');
  assert.equal(extractAcademicText('notes.md',Buffer.from('# Lecture notes')),'# Lecture notes');
  assert.throws(()=>extractAcademicText('fake.pdf',Buffer.from('not a pdf')),/signature/i);
  assert.throws(()=>extractAcademicText('program.exe',Buffer.from('x')),/supported uploads/i);
});
