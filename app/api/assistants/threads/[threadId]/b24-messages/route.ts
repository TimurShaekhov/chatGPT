import { openai } from "@/app/openai";

export const runtime = "nodejs";

// Send a new message to a thread
export async function POST(request, { params: { threadId } }) {
  const data = await request.json();

  await openai.beta.threads.messages.create(threadId, {
    role: data.role,
    content: (data.content).toString(),
  });

  let run = await openai.beta.threads.runs.create( threadId, { assistant_id: data.assistant_id } );
 
  let attempts = 0;
  while (attempts < 10) {
    run = await openai.beta.threads.runs.retrieve(threadId, run.id);
    if (run.status === "completed") {
        const messages = await openai.beta.threads.messages.list(threadId);
        const latestMessage = messages.data[0];
        
        return new Response(
          JSON.stringify({            
              thread_id: threadId,
              run_id: run.id,
              message_id: latestMessage.id,
              text: latestMessage.content[0].text.value,
              messages: messages,
              data: data,
              status: 'completed',
          }),
          { headers: { 'Content-Type': 'application/json' }, }
        )
    }
    
    // Если статус не "completed", ждём 3 секунды перед повторной проверкой
    await new Promise(resolve => setTimeout(resolve, 3000));
    attempts++;
  }

  //return new Response(stream.toReadableStream());
}
