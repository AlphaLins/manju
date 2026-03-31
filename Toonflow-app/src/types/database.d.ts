// @db-hash c209470d7f5ee67e83ba3486e90e7c5f
//该文件由脚本自动生成，请勿手动修改

export interface t_aiModelMap {
  'configId'?: number | null;
  'id'?: number;
  'key'?: string | null;
  'name'?: string | null;
}
export interface t_assets {
  'duration'?: string | null;
  'episode'?: string | null;
  'filePath'?: string | null;
  'id'?: number;
  'intro'?: string | null;
  'name'?: string | null;
  'projectId'?: number | null;
  'prompt'?: string | null;
  'remark'?: string | null;
  'scriptId'?: number | null;
  'segmentId'?: number | null;
  'shotIndex'?: number | null;
  'state'?: string | null;
  'type'?: string | null;
  'videoPrompt'?: string | null;
}
export interface t_chatHistory {
  'data'?: string | null;
  'id'?: number;
  'novel'?: string | null;
  'projectId'?: number | null;
  'type'?: string | null;
}
export interface t_config {
  'apiKey'?: string | null;
  'baseUrl'?: string | null;
  'createTime'?: number | null;
  'id'?: number;
  'manufacturer'?: string | null;
  'model'?: string | null;
  'modelType'?: string | null;
  'type'?: string | null;
  'userId'?: number | null;
}
export interface t_image {
  'assetsId'?: number | null;
  'filePath'?: string | null;
  'id'?: number;
  'projectId'?: number | null;
  'scriptId'?: number | null;
  'state'?: string | null;
  'type'?: string | null;
  'videoId'?: number | null;
}
export interface t_imageModel {
  'grid'?: number | null;
  'id'?: number;
  'manufacturer'?: string | null;
  'model'?: string | null;
  'type'?: string | null;
}
export interface t_novel {
  'chapter'?: string | null;
  'chapterData'?: string | null;
  'chapterIndex'?: number | null;
  'createTime'?: number | null;
  'id'?: number;
  'projectId'?: number | null;
  'reel'?: string | null;
}
export interface t_outline {
  'data'?: string | null;
  'episode'?: number | null;
  'id'?: number;
  'projectId'?: number | null;
}
export interface t_poetry_assets {
  'duration'?: string | null;
  'episode'?: string | null;
  'filePath'?: string | null;
  'id'?: number;
  'intro'?: string | null;
  'name'?: string | null;
  'poetryVideoPrompt'?: string | null;
  'projectId'?: number | null;
  'prompt'?: string | null;
  'remark'?: string | null;
  'scriptId'?: number | null;
  'segmentId'?: number | null;
  'shotIndex'?: number | null;
  'state'?: string | null;
  'type'?: string | null;
  'videoPrompt'?: string | null;
}
export interface t_poetry_chatHistory {
  'data'?: string | null;
  'id'?: number;
  'novel'?: string | null;
  'projectId'?: number | null;
  'type'?: string | null;
}
export interface t_poetry_image {
  'assetsId'?: number | null;
  'filePath'?: string | null;
  'id'?: number;
  'projectId'?: number | null;
  'scriptId'?: number | null;
  'state'?: string | null;
  'type'?: string | null;
  'videoId'?: number | null;
}
export interface t_poetry_music {
  'audio_url'?: string | null;
  'create_time'?: number | null;
  'error_message'?: string | null;
  'id'?: number;
  'music_prompt'?: string | null;
  'session_id': number;
  'status'?: string | null;
  'task_id'?: string | null;
  'update_time'?: number | null;
}
export interface t_poetry_novel {
  'chapter'?: string | null;
  'chapterData'?: string | null;
  'chapterIndex'?: number | null;
  'createTime'?: number | null;
  'id'?: number;
  'projectId'?: number | null;
  'reel'?: string | null;
}
export interface t_poetry_outline {
  'data'?: string | null;
  'episode'?: number | null;
  'id'?: number;
  'projectId'?: number | null;
}
export interface t_poetry_prompt {
  'duration'?: string | null;
  'id'?: number;
  'image_path'?: string | null;
  'sentence'?: string | null;
  'session_id': number;
  'sort_order'?: number | null;
  'video_path'?: string | null;
  'video_prompt'?: string | null;
  'video_task_id'?: number | null;
  'visual_prompt'?: string | null;
}
export interface t_poetry_script {
  'content'?: string | null;
  'id'?: number;
  'name'?: string | null;
  'outlineId'?: number | null;
  'projectId'?: number | null;
}
export interface t_poetry_session {
  'audio_path'?: string | null;
  'create_time'?: number | null;
  'grid_prompt'?: string | null;
  'id'?: number;
  'image_manufacturer'?: string | null;
  'music_prompt_json'?: string | null;
  'music_task_id'?: string | null;
  'overall_style'?: string | null;
  'poetry_content'?: string | null;
  'project_id'?: number | null;
  'title'?: string | null;
}
export interface t_poetry_storyline {
  'content'?: string | null;
  'id'?: number;
  'name'?: string | null;
  'novelIds'?: string | null;
  'projectId'?: number | null;
}
export interface t_poetry_taskList {
  'endTime'?: string | null;
  'id'?: number;
  'name'?: string | null;
  'projectName'?: number | null;
  'prompt'?: string | null;
  'startTime'?: string | null;
  'state'?: string | null;
}
export interface t_poetry_video {
  'aiConfigId'?: number | null;
  'configId'?: number | null;
  'create_time'?: number | null;
  'error_message'?: string | null;
  'errorReason'?: string | null;
  'filePath'?: string | null;
  'firstFrame'?: string | null;
  'id'?: number;
  'model'?: string | null;
  'prompt'?: string | null;
  'prompt_id': number;
  'resolution'?: string | null;
  'scriptId'?: number | null;
  'state'?: number | null;
  'status'?: string | null;
  'storyboardImgs'?: string | null;
  'task_id'?: string | null;
  'time'?: number | null;
  'update_time'?: number | null;
  'video_url'?: string | null;
}
export interface t_poetry_video_session {
  'create_time'?: number | null;
  'error_message'?: string | null;
  'id'?: number;
  'prompt_id': number;
  'status'?: string | null;
  'task_id'?: string | null;
  'update_time'?: number | null;
  'video_url'?: string | null;
}
export interface t_poetry_videoConfig {
  'aiConfigId'?: number | null;
  'audioEnabled'?: number | null;
  'createTime'?: number | null;
  'duration'?: number | null;
  'endFrame'?: string | null;
  'id'?: number;
  'images'?: string | null;
  'manufacturer'?: string | null;
  'mode'?: string | null;
  'projectId'?: number | null;
  'prompt'?: string | null;
  'resolution'?: string | null;
  'scriptId'?: number | null;
  'selectedResultId'?: number | null;
  'startFrame'?: string | null;
  'updateTime'?: number | null;
}
export interface t_project {
  'agentStyle'?: string;
  'artStyle'?: string | null;
  'createTime'?: number | null;
  'id'?: number | null;
  'intro'?: string | null;
  'name'?: string | null;
  'type'?: string | null;
  'userId'?: number | null;
  'videoRatio'?: string | null;
}
export interface t_prompts {
  'code'?: string | null;
  'customValue'?: string | null;
  'defaultValue'?: string | null;
  'id'?: number;
  'name'?: string | null;
  'parentCode'?: string | null;
  'type'?: string | null;
}
export interface t_script {
  'content'?: string | null;
  'id'?: number;
  'name'?: string | null;
  'outlineId'?: number | null;
  'projectId'?: number | null;
}
export interface t_setting {
  'id'?: number;
  'imageModel'?: string | null;
  'languageModel'?: string | null;
  'projectId'?: number | null;
  'tokenKey'?: string | null;
  'userId'?: number | null;
}
export interface t_storyline {
  'content'?: string | null;
  'id'?: number;
  'name'?: string | null;
  'novelIds'?: string | null;
  'projectId'?: number | null;
}
export interface t_taskList {
  'endTime'?: string | null;
  'id'?: number;
  'name'?: string | null;
  'projectName'?: number | null;
  'prompt'?: string | null;
  'startTime'?: string | null;
  'state'?: string | null;
}
export interface t_textModel {
  'id'?: number;
  'image'?: number | null;
  'manufacturer'?: string | null;
  'model'?: string | null;
  'responseFormat'?: string | null;
  'think'?: number | null;
  'tool'?: number | null;
}
export interface t_user {
  'id'?: number;
  'name'?: string | null;
  'password'?: string | null;
}
export interface t_video {
  'aiConfigId'?: number | null;
  'configId'?: number | null;
  'errorReason'?: string | null;
  'filePath'?: string | null;
  'firstFrame'?: string | null;
  'id'?: number;
  'model'?: string | null;
  'prompt'?: string | null;
  'resolution'?: string | null;
  'scriptId'?: number | null;
  'state'?: number | null;
  'storyboardImgs'?: string | null;
  'time'?: number | null;
}
export interface t_videoConfig {
  'aiConfigId'?: number | null;
  'audioEnabled'?: number | null;
  'createTime'?: number | null;
  'duration'?: number | null;
  'endFrame'?: string | null;
  'id'?: number;
  'images'?: string | null;
  'manufacturer'?: string | null;
  'mode'?: string | null;
  'projectId'?: number | null;
  'prompt'?: string | null;
  'resolution'?: string | null;
  'scriptId'?: number | null;
  'selectedResultId'?: number | null;
  'startFrame'?: string | null;
  'updateTime'?: number | null;
}
export interface t_videoModel {
  'aspectRatio'?: string | null;
  'audio'?: number | null;
  'durationResolutionMap'?: string | null;
  'id'?: number;
  'manufacturer'?: string | null;
  'model'?: string | null;
  'type'?: string | null;
}

export interface DB {
  "t_aiModelMap": t_aiModelMap;
  "t_assets": t_assets;
  "t_chatHistory": t_chatHistory;
  "t_config": t_config;
  "t_image": t_image;
  "t_imageModel": t_imageModel;
  "t_novel": t_novel;
  "t_outline": t_outline;
  "t_poetry_assets": t_poetry_assets;
  "t_poetry_chatHistory": t_poetry_chatHistory;
  "t_poetry_image": t_poetry_image;
  "t_poetry_music": t_poetry_music;
  "t_poetry_novel": t_poetry_novel;
  "t_poetry_outline": t_poetry_outline;
  "t_poetry_prompt": t_poetry_prompt;
  "t_poetry_script": t_poetry_script;
  "t_poetry_session": t_poetry_session;
  "t_poetry_storyline": t_poetry_storyline;
  "t_poetry_taskList": t_poetry_taskList;
  "t_poetry_video": t_poetry_video;
  "t_poetry_video_session": t_poetry_video_session;
  "t_poetry_videoConfig": t_poetry_videoConfig;
  "t_project": t_project;
  "t_prompts": t_prompts;
  "t_script": t_script;
  "t_setting": t_setting;
  "t_storyline": t_storyline;
  "t_taskList": t_taskList;
  "t_textModel": t_textModel;
  "t_user": t_user;
  "t_video": t_video;
  "t_videoConfig": t_videoConfig;
  "t_videoModel": t_videoModel;
}
