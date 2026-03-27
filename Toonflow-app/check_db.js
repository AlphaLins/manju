const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('g:/anime/toonflow_fresh/Toonflow-app/db.sqlite');
db.all("SELECT id, status, video_url, error_reason FROM t_poetry_video ORDER BY id DESC LIMIT 5", (err, rows) => {
    if (err) console.error(err);
    else console.log("--- t_poetry_video ---", JSON.stringify(rows, null, 2));
    db.all("SELECT * FROM t_config WHERE type='video'", (err, rows2) => {
        if (err) console.error(err);
        else console.log("--- t_config ---", JSON.stringify(rows2, null, 2));
        db.close();
    });
});
