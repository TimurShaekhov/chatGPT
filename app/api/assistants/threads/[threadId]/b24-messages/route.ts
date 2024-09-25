import { openai } from "@/app/openai";

export const runtime = "nodejs";

// Send a new message to a thread
export async function POST(request, { params: { threadId } }) {
  const data = await request.json();

  await openai.beta.threads.messages.create(threadId, {
    role: data.role,
    content: (data.content).toString(),
  });

  const stream = openai.beta.threads.runs.stream(threadId, {
    assistant_id: data.assistantId,
  });

  return new Response(JSON.stringify({ data: data, stream: stream }), {
    headers: { 'Content-Type': 'application/json' },
  });

  //return new Response(stream.toReadableStream());
}
