const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'db.sqlite'));

db.serialize(() => {
    db.run("ALTER TABLE t_poetry_session ADD COLUMN grid_prompt TEXT", (err) => {
        if (err) console.log(err.message);
        else console.log("Added grid_prompt");
    });
    db.run("ALTER TABLE t_poetry_session ADD COLUMN music_prompt_json TEXT", (err) => {
        if (err) console.log(err.message);
        else console.log("Added music_prompt_json");
    });
    db.run("ALTER TABLE t_poetry_session ADD COLUMN image_manufacturer TEXT", (err) => {
        if (err) console.log(err.message);
        else console.log("Added image_manufacturer");
    });
});

db.close();
