import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'db.sqlite');
const db = new Database(dbPath);

const stmtPromptList = db.prepare('SELECT * FROM t_prompts WHERE id < 200');
const basePrompts = stmtPromptList.all();

const stmtInsert = db.prepare('INSERT OR IGNORE INTO t_prompts (id, code, name, type, parentCode, defaultValue, customValue) VALUES (@id, @code, @name, @type, @parentCode, @defaultValue, @customValue)');

let pCount = 0;
for (let p of basePrompts) {
    if (!p) continue;

    let newCode = p.code
        .replace(/outlineScript/g, "poetryOutlineScript")
        .replace(/storyboard/g, "poetryStoryboard")
        .replace(/generateImagePrompts/g, "generatePoetryImagePrompts");
        
    if (newCode !== p.code) {
        let newParentCode = p.parentCode ? p.parentCode
            .replace(/outlineScript/g, "poetryOutlineScript")
            .replace(/storyboard/g, "poetryStoryboard")
            .replace(/generateImagePrompts/g, "generatePoetryImagePrompts") : null;
            
        let newName = p.name.includes("古诗词") ? p.name : "古诗词-" + p.name;
        
        try {
            const res = stmtInsert.run({
                ...p,
                id: 200 + p.id,
                code: newCode,
                name: newName,
                parentCode: newParentCode,
                customValue: null
            });
            if (res.changes > 0) pCount++;
        } catch(e) {
            console.log("Error inserting poetry prompt:", e.message);
        }
    }
}
console.log(`Inserted ${pCount} poetry prompts.`);
