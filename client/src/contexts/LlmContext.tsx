import { createContext, useContext } from 'react';

export const LlmContext = createContext<string>('openai/gpt-oss-20b');

export const LlmProvider = LlmContext.Provider;

export function useLlm(): string {
  return useContext(LlmContext);
}
