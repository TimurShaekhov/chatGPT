import { openai } from "@/app/openai";

export const runtime = "nodejs";

// Send a new message from other SERVER to a thread
export async function POST(request, { params: { threadId } }) {
  const data = await request.json();

  if (!data.content) {
    throw new Error('Content is required. Received data:', data);
  }

  await openai.beta.threads.messages.create(threadId, {
    role: data.role,
    content: data.content.toString(),
  });

  let run = await openai.beta.threads.runs.create( threadId, { assistant_id: data.assistantId } );
 
  let attempts = 0;
  while (attempts < 10) {
    run = await openai.beta.threads.runs.retrieve(threadId, run.id);
    if (run.status === "completed") {
        const messages = await openai.beta.threads.messages.list(threadId);
        const latestMessage = messages.data[0];
        
        return {
            thread_id: threadId,
            run_id: run.id,
            message: latestMessage,
            data: data,
            status: 'completed',
          }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  return { data: data, status: 'failed' };
}
