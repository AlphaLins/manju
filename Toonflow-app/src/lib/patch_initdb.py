import re
import json

file_path = "G:/anime/toonflow_fresh/Toonflow-app/src/lib/initDB.ts"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Tables to duplicate
tables_to_dup = [
    "t_assets", "t_chatHistory", "t_novel", "t_outline", 
    "t_storyline", "t_script", "t_video", "t_taskList", 
    "t_image", "t_videoConfig"
]

new_tables = []

for table in tables_to_dup:
    # the format is usually:
    #     {
    #       name: "t_video",
    #       builder: (table) => {
    #         ...
    #       },
    #     },
    # There might be initData. 
    pattern = r'(\{\s*name:\s*"' + table + r'".*?builder:\s*\(table\)\s*=>\s*\{.*?\},\s*(?:initData:.*?\},)?\s*\})'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        table_def = match.group(1)
        # Handle case where trailing comma is missing inside the group or adds up
        # Rename t_... to t_poetry_... inside the definition
        new_table_def = table_def.replace(f'name: "{table}"', f'name: "t_poetry_{table[2:]}"')
        new_tables.append(new_table_def)

# Find the end of tables array. Wait, tables array ends around line 1254:
#             type: JSON.stringify(["startEndRequired", "text"]),
#           },
#           {
#             id: 55, ...
#             type: JSON.stringify(["audioOnly"]),
#           },
#         ]);
#       },
#     },
#   ];
# We can inject new tables right before t_config or just before the `];`
# Actually, the easiest way is to insert them before `name: "t_config"`

t_config_idx = content.find('name: "t_config"')
block_start = content.rfind('{', 0, t_config_idx)

new_tables_str = ',\n    '.join(new_tables) + ',\n    '

new_content = content[:block_start] + new_tables_str + content[block_start:]

# Now, let's patch the prompts to add poetry prompts
# Find the prompts init data.
prompts_to_add = []
prompts_to_dup = [
    ("outlineScript-main", "poetryOutlineScript-main", "古诗词-大纲故事线Agent"),
    ("outlineScript-a1", "poetryOutlineScript-a1", "古诗词-大纲故事线Agent-故事师"),
    ("outlineScript-a2", "poetryOutlineScript-a2", "古诗词-大纲故事线Agent-大纲师"),
    ("outlineScript-director", "poetryOutlineScript-director", "古诗词-大纲故事线Agent-导演"),
    ("storyboard-main", "poetryStoryboard-main", "古诗词-分镜Agent"),
    ("storyboard-segment", "poetryStoryboard-segment", "古诗词-分镜Agent-片段分析师"),
    ("storyboard-shot", "poetryStoryboard-shot", "古诗词-分镜Agent-分镜师"),
    ("generateImagePrompts", "generatePoetryImagePrompts", "古诗词-分镜Agent生图润色提示词")
]

# We need to find the highest ID in t_prompts so far
prompts_init = re.search(r'name:\s*"t_prompts".*?initData:\s*async\s*\(knex\)\s*=>\s*\{.*?await\s*knex\("t_prompts"\)\.insert\(\[(.*?)\]\);', new_content, re.DOTALL)

if prompts_init:
    prompts_array_str = prompts_init.group(1)
    
    # Extract existing IDs
    id_matches = re.findall(r'id:\s*(\d+)', prompts_array_str)
    next_id = max([int(i) for i in id_matches]) + 1 if id_matches else 100
    
    added_prompts_code = []
    for (old_code, new_code, new_name) in prompts_to_dup:
        # Find the specific prompt block
        pattern = r'\{\s*id:\s*\d+,\s*code:\s*"' + old_code + r'".*?\}'
        m = re.search(pattern, prompts_array_str, re.DOTALL)
        if m:
            p_block = m.group(0)
            # modify id, code, name
            p_block = re.sub(r'id:\s*\d+', f'id: {next_id}', p_block)
            next_id += 1
            p_block = re.sub(r'code:\s*"' + old_code + r'"', f'code: "{new_code}"', p_block)
            # name can be handled by regex
            p_block = re.sub(r'name:\s*".*?"', f'name: "{new_name}"', p_block)
            
            # replace parentCode if it exists and refers to an old code
            if "parentCode:" in p_block:
                for (oc, nc, _) in prompts_to_dup:
                    p_block = p_block.replace(f'parentCode: "{oc}"', f'parentCode: "{nc}"')
            
            added_prompts_code.append(p_block)
            
    # Insert added prompts at the end of the prompts array
    if added_prompts_code:
        new_prompts_str = prompts_array_str + ',\n          ' + ',\n          '.join(added_prompts_code) + '\n        '
        new_content = new_content.replace(prompts_array_str, new_prompts_str)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("initDB.ts patched successfully.")
