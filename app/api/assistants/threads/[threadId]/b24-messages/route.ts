import { assistantId } from "@/app/assistant-config";
import { openai } from "@/app/openai";

export const runtime = "nodejs";

// Send a new message to a thread
export async function POST(request) {
  const data = await request.json();

  await openai.beta.threads.messages.create(data.threadId, {
    role: data.user,
    content: data.content,
  });

  const stream = openai.beta.threads.runs.stream(data.threadId, {
    assistant_id: data.assistantId,
  });

  return new Response(JSON.stringify({ data: data, stream: stream }), {
    headers: { 'Content-Type': 'application/json' },
  });

  //return new Response(stream.toReadableStream());
}
