import { openai } from "@/app/openai";

export const runtime = "nodejs";

// Функция для генерации изображения с использованием настроенного объекта openai
async function generateImage(prompt) {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    n: 1,
    size: '1024x1024',
  });

  const imageUrl = response.data[0].url;
  return imageUrl; // Возвращаем URL изображения
}

// Send a new message from other SERVER to a thread
export async function POST(request, { params: { threadId } }) {
  const data = await request.json();

  if (!data.content) {
    throw new Error('Content is required. Received data:', data);
  }
  
  // Обработка создания нового потока
  if (threadId === 'create-new-thread') {
    const emptyThread = await openai.beta.threads.create();
    threadId = emptyThread.id;

    if (data.ClientJson) {
      await openai.beta.threads.messages.create(threadId, {
        role: 'assistant',
        content: data.ClientJson,
      });
    }
  }

  let requiresGraph = false;
  let imageUrl = null;

  for (let i = 0; i < data.content.length; i++) {
    let content = data.content[i];
    await openai.beta.threads.messages.create(threadId, {
      role: content.role,
      content: content.message.toString(),
    });

    // Проверяем, нужно ли генерировать изображение
    if (content.message.toLowerCase().includes("{генерация}")) {
      requiresGraph = true;
      imageUrl = await generateImage(content.message);
      if (imageUrl) {
        await openai.beta.threads.messages.create(threadId, {
          role: 'assistant',
          content: `imageUrl: ${imageUrl}`,
        });
        return new Response(
          JSON.stringify({
            thread_id: threadId,
            message: imageUrl,
            data: data,
            status: 'completed',
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  if (!requiresGraph) {
    let run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: data.assistantId,
      ...(data.additional_instructions && { additional_instructions: data.additional_instructions }),
    });
    
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

      if (["requires_action", "cancelling", "cancelled", "failed", "expired"].includes(run.status)) {
        console.log('Run has problems. Exiting the loop.');
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
  }

  return new Response(
    JSON.stringify({ data: data, status: 'failed' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}