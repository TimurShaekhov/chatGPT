import { openai } from "@/app/openai";
import fs from "fs";

export const runtime = "nodejs";

// Функция для генерации изображения с использованием настроенного объекта openai
async function generateImage(prompt) {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    n: 1,
    size: '1024x1024',
  });

  return response.data[0].url; // Возвращаем URL изображения
}

// Send a new message from other SERVER to a thread
export async function POST(request, { params: { threadId } }) {
  const data = await request.json();

  if (!data.messages) {
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

  for (let message of data.messages) {
    //Загрузка файлов, запуск функций и т.д.
    if (typeof message.content === 'object') {
      for (let elIndex = 0; elIndex < message.content.length; elIndex++) {
        let el = message.content[elIndex];
        if (el.type === 'image_url') {
          const file = await openai.files.create({
            file: fs.createReadStream(el.image_url.url),
            purpose: "assistants",
          });
  
          message.content[elIndex] = {
            type: "image_file",
            image_file: {
              file_id: file.id,
            },
          };
        }
      }
    }
  
    await openai.beta.threads.messages.create(threadId, {
      role: message.role,
      content: message.content,
    });
  }
  

  let run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: data.assistantId,
    ...(data.additional_instructions && { additional_instructions: data.additional_instructions }),
  });
  
  let attempts = 0;
  while (attempts < 90) { 
    run = await openai.beta.threads.runs.retrieve(threadId, run.id);
    
    if (run.status === "completed") {
      const messages = await openai.beta.threads.messages.list(threadId);
      let latestMessage = messages.data[0];
      let textMessage = latestMessage.content[0].type === 'text' ? latestMessage.content[0].text.value : '';
      // Проверяем, нужно ли генерировать изображение
      if (textMessage && textMessage.includes('generateImage')) {
        const parsedContent = JSON.parse(textMessage);
        if (parsedContent.generate) {
          const imageUrl = await generateImage(parsedContent.generate);
          if(latestMessage.content[0].type === 'text') latestMessage.content[0].text.value += `\nimageUrl: ${imageUrl}`;
        }
      }

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

  return new Response(
    JSON.stringify({ data: data, status: 'failed' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}