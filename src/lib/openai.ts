import OpenAI from "openai";
import config from "../config.ts";

export const openAiClient = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
});