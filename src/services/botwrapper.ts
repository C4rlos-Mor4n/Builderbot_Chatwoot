import { Chatwoot_Client } from "./chatwoot_client";
import Queue from "queue-promise";
import { join } from "path";

export class BotWrapper {
  static BotInstance = null;
  static Chatwoot = null;
  static queue = new Queue({
    concurrent: 1,
    interval: 200,
    start: true,
  });

  static async init(
    _bot: any,
    _options: {
      PORT: number;
      CHATWOOT_URL: string;
      CHATWOOT_ID: number;
      CHATWOOT_API_ACCESS_TOKEN: string;
      CHATWOOT_INBOX_ID: number;
    }
  ) {
    if (Object.keys(_options).length === 0) {
      throw new Error(
        "Las credenciales de Chatwoot son necesarias para iniciar el bot"
      );
    }

    if (!_bot) {
      throw new Error(
        "la instancia del bot es necesario para iniciar el wrapper"
      );
    }

    this.BotInstance = _bot;
    this.Chatwoot = new Chatwoot_Client(_options, this.BotInstance.provider);
    this.checkAndCreateAttribute();
    this.SetupBotListeners(_options.PORT);
  }

  static async checkAndCreateAttribute() {
    try {
      const attributeExists = await this.Chatwoot.isAttributeCreated();
      if (!attributeExists) {
        await this.Chatwoot.createAttributes();
      }
    } catch (error) {
      console.error("Error al verificar o crear el atributo:", error);
    }
  }

  static async processOutgoingMessageAgent(data: any) {
    const createOutGoing =
      data?.private == false &&
      data?.event == "message_created" &&
      data?.message_type === "outgoing" &&
      data?.conversation?.channel.includes("Channel::Api");
    if (createOutGoing) {
      const phone = data?.conversation?.meta?.sender?.phone_number.replace(
        "+",
        ""
      );
      const content = data?.content ?? "";
      const mediaUrl = data?.attachments?.[0]?.data_url;

      if (data.attachments && data.attachments.length > 0) {
        const fileType = data.attachments[0].file_type;

        if (fileType === "image") {
          return await this.BotInstance.provider.sendMedia(
            `${phone}@c.us`,
            mediaUrl,
            content
          );
        }

        if (fileType === "video") {
          return await this.BotInstance.provider.sendMedia(
            `${phone}@c.us`,
            mediaUrl,
            content
          );
        }
        if (fileType === "audio") {
          return await this.BotInstance.provider.sendMedia(
            `${phone}@c.us`,
            mediaUrl,
            content
          );
        }
        if (fileType === "file") {
          return await this.BotInstance.provider.sendMedia(
            `${phone}@c.us`,
            mediaUrl,
            content
          );
        }
      } else {
        return await this.BotInstance.provider.sendText(
          `${phone}@c.us`,
          content
        );
      }
    }
  }

  static async processWebhook(req, res) {
    try {
      const { body } = req;
      if (body?.conversation?.meta?.sender?.phone_number === "+593999999999") {
        return res.end();
      }

      if (body.content_type === "input_csat") {
        if (body.content_attributes?.submitted_values?.csat_survey_response) {
          return "";
        }

        const MensajeCalificacion = await body?.content;
        const number = body?.conversation?.meta?.sender?.phone_number.replace(
          /^\+/,
          ""
        );

        return this.BotInstance.provider.sendText(
          `${number}@c.us`,
          MensajeCalificacion
        );
      }
      let funcionesDelBot;

      if (body.custom_attributes?.funciones_del_bot) {
        funcionesDelBot = body.custom_attributes.funciones_del_bot;
      } else if (body.sender?.custom_attributes?.funciones_del_bot) {
        funcionesDelBot = body.sender.custom_attributes.funciones_del_bot;
      } else {
        funcionesDelBot =
          body.conversation?.meta?.sender?.custom_attributes?.funciones_del_bot;
      }

      const getBlacklistSnapshot =
        await this.BotInstance.dynamicBlacklist.getList();
      const numberOrId =
        body.event === "contact_updated" && body.phone_number
          ? body.phone_number.replace(/^\+/, "")
          : "";

      if (
        funcionesDelBot === "ON" &&
        getBlacklistSnapshot.includes(numberOrId)
      ) {
        await this.BotInstance.dynamicBlacklist.remove(numberOrId);
      } else if (
        funcionesDelBot === "OFF" &&
        !getBlacklistSnapshot.includes(numberOrId)
      ) {
        await this.BotInstance.dynamicBlacklist.add(numberOrId);
      }

      if (body.event === "message_created") {
        this.queue.enqueue(async () => {
          return await this.processOutgoingMessageAgent(body);
        });
      }

      res.end("Evento del agente procesado.");
      return;
    } catch (error) {
      console.error("Error al procesar el webhook:", error);
      res.end("Error al procesar el webhook.");
    }
  }

  static async SetupBotListeners(PORT: number) {
    await this.BotInstance.provider.server.post(
      "/webhook",
      this.processWebhook.bind(this)
    );

    await this.BotInstance.httpServer(+PORT);

    this.BotInstance.provider.on("require_action", async () => {
      //espere unos segundos antes de enviar la respuesta
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const QrCode = join(process.cwd(), "bot.qr.png");
      if (!QrCode) {
        return;
      }
      return await this.Chatwoot.sendMessageAttachment(
        "593999999999",
        "Escanea el código QR para iniciar sesión",
        QrCode,
        "incoming",
        false,
        null,
        "Chat_BOT"
      );
    });

    this.BotInstance.provider.on("ready", async (data) => {
      if (!data) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return await this.Chatwoot.sendMessage(
        "593999999999",
        `🔥EL CHATBOT ESTA LISTO PARA INTERACTUAR🔥`,
        "incoming",
        false,
        "Chat_BOT"
      );
    });

    this.BotInstance.provider.on("message", (message: any) => {
      this.queue.enqueue(async () => {
        return await this.processIncomingMessage(message);
      });
    });

    this.BotInstance.on("send_message", (message: any) => {
      this.queue.enqueue(async () => {
        return await this.processOutgoingMessage(message);
      });
    });
  }

  static async processOutgoingMessage(data: any) {
    const { from, answer, options } = await data;
    const { media } = await options;

    if (media) {
      return await this.Chatwoot.sendMessageAttachment(
        from,
        answer,
        media,
        "outgoing",
        false
      );
    }

    return await this.Chatwoot.sendMessage(from, answer, "outgoing", false);
  }

  static async processIncomingMessage(data: any) {
    const { from, body, name } = await data;
    if (body.includes("_event_")) {
      return await this.Chatwoot.sendMessageAttachment(
        from,
        null,
        [],
        "incoming",
        false,
        data,
        name
      );
    }

    return await this.Chatwoot.sendMessage(from, body, "incoming", false, name);
  }
}
