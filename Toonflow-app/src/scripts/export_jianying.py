import os
import sys
import json
import urllib.request
import tempfile
import time
import subprocess

# Initialization to find Jianying Skill
# 1. 环境初始化 (必须同步到脚本开头)
current_dir = os.path.dirname(os.path.abspath(__file__))
env_root = os.getenv("JY_SKILL_ROOT", "").strip()

# 探测 Skill 路径
skill_root = next((p for p in [
    env_root,
    os.path.join(current_dir, "..", "..", "..", ".agent", "skills", "jianying-editor"),
    os.path.join(current_dir, "..", "..", "..", ".gemini", "antigravity", "skills", "jianying-editor"),
    os.path.expanduser("~/.gemini/antigravity/skills/jianying-editor"),
] if p and os.path.exists(os.path.join(p, "scripts", "jy_wrapper.py"))), None)

if not skill_root:
    print(json.dumps({"code": 500, "message": "Could not find jianying-editor skill root"}))
    sys.exit(1)

sys.path.insert(0, os.path.join(skill_root, "scripts"))
from jy_wrapper import JyProject

def download_if_remote(url_or_path: str) -> str:
    if not url_or_path:
        return ""
    if url_or_path.startswith("http://") or url_or_path.startswith("https://"):
        # Download
        ext = url_or_path.split("?")[0].split(".")[-1]
        if len(ext) > 5:
            ext = "temp" # fallback
        temp_dir = tempfile.gettempdir()
        filename = f"jy_dl_{int(time.time()*1000)}.{ext}"
        local_path = os.path.join(temp_dir, filename)
        try:
            # Use request with User-Agent to prevent 403
            req = urllib.request.Request(
                url_or_path, 
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            with urllib.request.urlopen(req) as response, open(local_path, 'wb') as out_file:
                out_file.write(response.read())
            return local_path
        except Exception as e:
            print(json.dumps({"code": 500, "message": f"Failed to download remote file: {url_or_path}. Error: {e}"}))
            sys.exit(1)
            
    # Normalize local path if it's already local
    # If the URL is http://127.0.0.1:xxx/uploads/..., convert it directly.
    # The Node.js caller will resolve local oss urls beforehand, so it should be a pure local path.
    return url_or_path

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"code": 400, "message": "Missing JSON input argument"}))
        sys.exit(1)
        
    try:
        data = json.loads(sys.argv[1])
    except:
        # Maybe it's a file path
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            data = json.loads(f.read())
            
    title = data.get("title", "诗韵画境_导出")
    exec_path = data.get("exec_path", "")
    audio_path = data.get("audio_path", "")
    segments = data.get("segments", [])
    
    try:
        project = JyProject(title, overwrite=True)
        
        # Add Audio background
        if audio_path:
            local_audio = download_if_remote(audio_path)
            if os.path.exists(local_audio):
                project.add_audio_safe(local_audio, "0s", track_name="BGM_Track")
                
        # Calculate video flow
        current_time_s = 0.0
        
        for idx, seg in enumerate(segments):
            media = seg.get("media_path")
            sentence = seg.get("sentence", "")
            
            if not media:
                continue
                
            local_media = download_if_remote(media)
            if not os.path.exists(local_media):
                continue
                
            # Each segment default duration
            duration_s = 5.0
            
            project.add_media_safe(
                local_media, 
                start_time=f"{current_time_s}s", 
                duration=f"{duration_s}s", 
                track_name="Main_Track"
            )
            
            if sentence:
                # Adding styled text (flower text) for poetry
                # You can use a known style ID from cloud_text_styles.csv
                # We'll use a normal text simple with an animation for safety or style_id
                # '7351316503771368713' is a red flower text included in the default library, let's try styled_text
                # if styled_text fails (not in cache), we fallback to simple text. The wrapper handles this.
                try:
                    project.add_styled_text(
                        text=sentence,
                        style_id="7351316503771368713", # 红色花字
                        start_time=f"{current_time_s}s",
                        duration=f"{duration_s}s",
                        transform_y=-0.80
                    )
                except:
                    # Fallback simple text
                    project.add_text_simple(
                        text=sentence,
                        start_time=f"{current_time_s}s",
                        duration=f"{duration_s}s",
                        transform_y=-0.80,
                        anim_in="复古打字机"
                    )
                    
            current_time_s += duration_s

        project.save()
        draft_path = project.get_draft_path()
        
        # Attempt to launch Jianying
        if exec_path and os.path.exists(exec_path):
            # open jianying
            subprocess.Popen([exec_path])
            
        print(json.dumps({
            "code": 200, 
            "message": "Export success", 
            "data": {"draft_path": draft_path}
        }))

    except Exception as e:
        print(json.dumps({"code": 500, "message": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
