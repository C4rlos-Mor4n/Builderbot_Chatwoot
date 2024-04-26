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
import { join } from "path";

const fullSamplesFlow = addKeyword(["Prueba", utils.setEvent("SAMPLES")])
  .addAnswer(`Send image from Local`, {
    media: join(process.cwd(), "assets", "sample.png"),
  })
  .addAnswer(`Send video from URL`, {
    media:
      "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTJ0ZGdjd2syeXAwMjQ4aWdkcW04OWlqcXI3Ynh1ODkwZ25zZWZ1dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/LCohAb657pSdHv0Q5h/giphy.mp4",
  })
  .addAnswer(`Send audio from URL`, {
    media: "https://cdn.freesound.org/previews/728/728142_11861866-lq.mp3",
  })
  .addAnswer(`Send file from URL`, {
    media:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  });

const main = async () => {
  const adapterFlow = createFlow([fullSamplesFlow]);
  const adapterProvider = createProvider(Provider);
  const adapterDB = new Database();

  const BOT = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  BOT.provider

  await BotWrapper.init(BOT, {
    PORT: parseInt(process.env.PORT ?? "3008"),
    CHATWOOT_URL: process.env.CHATWOOT_URL, // example: http://127.0.0.1:3000/api/v1/accounts
    CHATWOOT_ID: parseInt(process.env.CHATWOOT_ID), // example: 1 (account id)
    CHATWOOT_INBOX_ID: parseInt(process.env.CHATWOOT_INBOX_ID), // example: 1 (inbox id)
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN, // example: 1 (inbox id)
  });
};

main();
