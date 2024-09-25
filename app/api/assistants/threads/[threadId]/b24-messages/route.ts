import { openai } from "@/app/openai";

export const runtime = "nodejs";

// Send a new message from other SERVER to a thread
export async function POST(request, { params: { threadId } }) {
  const data = await request.json();

  if (!data.content) {
    throw new Error('Content is required. Received data:', data);
  }
  if(threadId === 'create-new-thread'){
    // create a new threadID
    const res = await fetch(`/api/assistants/threads`, {
      method: "POST",
    });
    threadId = await res.json();
  }

  await openai.beta.threads.messages.create(threadId, {
    role: data.role,
    content: data.content.toString(),
  });

  let run = await openai.beta.threads.runs.create(threadId, { assistant_id: data.assistantId });
  
  let attempts = 0;
  while (attempts < 90) {
    run = await openai.beta.threads.runs.retrieve(threadId, run.id);
    
    if (run.status === "completed") {
      const messages = await openai.beta.threads.messages.list(threadId);
      const latestMessage = messages.data[0];
      
      return new Response(
        JSON.stringify({
          thread_id: threadId,
          run_id: run.id,
          message: latestMessage,
          data: data,
          status: 'completed',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (["requires_action",
       "cancelling",
       "cancelled",
       "failed",
       "expired",
       ].includes(run.status)) {
      console.log('Run has problems. Exiting the loop.');
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  return new Response(
    JSON.stringify({data: data, status: 'failed'}),
    { headers: { 'Content-Type': 'application/json' } }
  );
}