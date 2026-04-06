import { createContext, useContext } from 'react';

export const LlmContext = createContext<string>('gemini-2.0-flash');

export const LlmProvider = LlmContext.Provider;

export function useLlm(): string {
  return useContext(LlmContext);
}
