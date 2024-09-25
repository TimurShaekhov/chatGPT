export let assistantId = "asst_Wy2kYVubyFuEdINfw4n4ZPD3"; // set your assistant ID here

if (assistantId === "") {
  assistantId = process.env.OPENAI_ASSISTANT_ID;
}
