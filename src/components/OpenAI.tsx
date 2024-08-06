import openai from "@/app/config/openapi";

export default async function OpenAI({
  eventSummaries,
}: {
  eventSummaries: any;
  greeting: string;
  setGreeting: (greeting: string) => void;
}) {
  let greeting = "";
  if (eventSummaries.length > 0) {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Hello!" }],
    });
    greeting = response.choices[0].message.content || "";
  }
  return <div>{greeting}</div>;
}
