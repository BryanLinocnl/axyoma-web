import { ChatShell } from '@/components/playground/chat/chat-shell'

// P5 — Chat (playground estilo claude.ai, identidade Axyoma). Toda a lógica de
// streaming/persistência fica no ChatShell (client). LLM via proxy server-only.
export default function PlaygroundChatPage(): React.JSX.Element {
  return <ChatShell />
}
