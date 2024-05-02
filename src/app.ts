import "dotenv/config";
import {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
  utils,
} from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { BotWrapper } from "./services/botwrapper";

const main = async () => {
  const adapterFlow = createFlow([]);
  const adapterProvider = createProvider(Provider, { writeMyself: "both" });
  const adapterDB = new Database();

  const BOT = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  await BotWrapper.init(BOT, {
    PORT: parseInt(process.env.PORT ?? "3008"),
    CHATWOOT_URL: process.env.CHATWOOT_URL,
    CHATWOOT_ID: parseInt(process.env.CHATWOOT_ID),
    CHATWOOT_INBOX_ID: parseInt(process.env.CHATWOOT_INBOX_ID),
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
  });
};

main();
