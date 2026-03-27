import "../type";
import openAi from "./openAi";

export default async (input: VideoConfig, config: AIConfig) => {
  return await openAi(input, config);
};
