import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function trainingRoster(data) {
  const employees=[];
  for(const [showroomKey,s] of Object.entries(data.showrooms)) {
    for(const e of s.employees) {
      if(!['영업직원','영업팀장'].includes(e.role) || !e.name || !/^\d{4}-\d{2}-\d{2}$/.test(e.hireDate||'')) continue;
      employees.push({key:`${showroomKey}:${encodeURIComponent(e.name)}:${e.hireDate}`,dealer:s.dealer,
        showroom:s.showroom.replace(/^볼보\s*/,''),name:e.name,role:e.role,hireDate:e.hireDate});
    }
  }
  if(employees.length<300) throw new Error('Refusing abnormally small roster');
  return {schemaVersion:1,source:'Data Dashboard / Sales DMS',checkedAt:data.source.rosterCheckedAt,
    tenureBasis:'hireDate',employees};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const data=JSON.parse(readFileSync(path.join(root,'app/data/voc-staff-analysis.json'),'utf8'));
  const target=path.resolve(root,process.argv[2]||'work/github-pages-stage/training-roster.json');
  mkdirSync(path.dirname(target),{recursive:true});
  const roster=trainingRoster(data);
  const supplement=path.join(root,'app/data/training-selekt-roster.json');
  if(existsSync(supplement)) {
    const selekt=JSON.parse(readFileSync(supplement,'utf8'));
    if(selekt.checkedAt!==roster.checkedAt) throw new Error('SELEKT roster date mismatch');
    roster.employees.push(...selekt.employees);
  }
  writeFileSync(target,JSON.stringify(roster));
  console.log(`Training roster: ${roster.employees.length} active staff, checked ${roster.checkedAt}`);
}
