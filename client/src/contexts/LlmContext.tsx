import { createContext, useContext } from 'react';

export const LlmContext = createContext<string>('deepseek-flash');

export const LlmProvider = LlmContext.Provider;

export function useLlm(): string {
  return useContext(LlmContext);
}
