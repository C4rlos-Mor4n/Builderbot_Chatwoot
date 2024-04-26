import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import Queue from "queue-promise";
import FormData from "form-data";
import fs from "fs";
import {
  Contact,
  Conversation,
  AttributeDefinition,
  MediaData,
} from "./types/index";

/**
 * Represents a client for interacting with the Chatwoot API.
 */
class Chatwoot_Client {
  private CHATWOOT_URL: string;
  private CHATWOOT_ID: number;
  private CHATWOOT_API_ACCESS_TOKEN: string;
  private CHATWOOT_INBOX_ID: number;
  private provider: any;
  static locks = {};
  static queue = new Queue({
    concurrent: 1,
    interval: 200,
    start: true,
  });

  constructor(
    options: {
      CHATWOOT_URL: string;
      CHATWOOT_ID: number;
      CHATWOOT_API_ACCESS_TOKEN: string;
      CHATWOOT_INBOX_ID: number;
    },
    Instance?: any
  ) {
    this.CHATWOOT_URL = options.CHATWOOT_URL;
    this.CHATWOOT_ID = options.CHATWOOT_ID;
    this.CHATWOOT_API_ACCESS_TOKEN = options.CHATWOOT_API_ACCESS_TOKEN;
    this.CHATWOOT_INBOX_ID = options.CHATWOOT_INBOX_ID;
    this.provider = Instance;
  }

  /**
   * Encola una solicitud a la API de Chatwoot.
   * @param endpoint - El punto final de la API al que se enviará la solicitud.
   * @param options - La configuración de la solicitud Axios.
   * @returns Una promesa que se resuelve con los datos de respuesta de la API.
   */
  private async _enqueueRequest(
    endpoint: string,
    options: AxiosRequestConfig = {}
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      Chatwoot_Client.queue.enqueue(async () => {
        try {
          console.log("Enviando solicitud a Chatwoot:", endpoint, options);
          console.log(
            this.CHATWOOT_URL,
            this.CHATWOOT_ID,
            this.CHATWOOT_API_ACCESS_TOKEN,
            this.CHATWOOT_INBOX_ID
          );

          const response: AxiosResponse = await axios({
            ...options,
            url: `${this.CHATWOOT_URL}/${this.CHATWOOT_ID}${endpoint}`,
            headers: {
              "Content-Type": "application/json",
              api_access_token: this.CHATWOOT_API_ACCESS_TOKEN,
              ...options.headers,
            },
          });

          resolve(response.data);
        } catch (error) {
          console.error(
            "Error en _enqueueRequest",
            error.response?.data || error.message
          );
          reject(new Error(error));
        }
      });
    });
  }

  /**
   * Realiza una solicitud al endpoint especificado utilizando las opciones proporcionadas.
   * @param endpoint El endpoint al que se realizará la solicitud.
   * @param options Las opciones de configuración para la solicitud.
   * @returns Una promesa que se resuelve con la respuesta de la solicitud.
   */
  private async _request(
    endpoint: string,
    options?: AxiosRequestConfig
  ): Promise<any> {
    return await this._enqueueRequest(endpoint, options);
  }

  /**
   * Obtiene el ID de usuario de Chatwoot basado en el número de teléfono.
   * @param {string} userPhone - Número de teléfono del usuario.
   */
  async getUserID(userPhone: string): Promise<number | false> {
    const data = await this._request(`/contacts/search`, {
      params: { q: `+${userPhone}` },
    });
    const contact: Contact = data.payload[0];
    if (!contact) {
      return false;
    }
    return contact.id;
  }

  /**
   * Establece los atributos personalizados del usuario en Chatwoot.
   * @param {string} userPhone - Número de teléfono del usuario.
   * @param {string} field - Campo a actualizar.
   * @param {Object} attributes - Atributos a establecer.
   */
  async setAttributes(
    userPhone: string,
    field: string,
    attributes: any
  ): Promise<boolean> {
    const userID = await this.getUserID(userPhone);
    await this._request(`/contacts/${userID}`, {
      method: "PUT",
      data: { custom_attributes: { [field]: attributes } },
    });
    return true;
  }

  /**
   * Obtiene los atributos personalizados del usuario en Chatwoot.
   * @param {string} userPhone - Número de teléfono del usuario.
   */
  async getAttributes(userPhone: string): Promise<boolean> {
    const data = await this._request(`/contacts/search`, {
      params: { q: `+${userPhone}` },
    });

    const contact: Contact = await data.payload[0];

    if (
      !contact.custom_attributes ||
      !contact.custom_attributes.funciones_del_bot
    ) {
      return false;
    }
    return true;
  }

  /**
   * Obtiene el ID de conversación de Chatwoot para un usuario.
   * @param {string} userID - ID de usuario en Chatwoot.
   */
  async getConversationID(userID: number): Promise<number | false> {
    const data = await this._request(`/contacts/${userID}/conversations`);
    const conversations: Conversation[] = data.payload[0]?.messages;
    if (!conversations || conversations.length === 0) {
      return false;
    }
    const conversation = conversations.find(
      (c) => c.inbox_id == (this.CHATWOOT_INBOX_ID as number)
    );
    if (!conversation) {
      throw new Error(
        `No conversation found with inbox_id ${this.CHATWOOT_INBOX_ID}`
      );
    }
    return conversation.conversation_id;
  }

  /**
   * Verifica si el atributo personalizado "Funciones del Bot" ya está creado en la cuenta especificada.
   *
   * @param {integer} account_id - El ID numérico de la cuenta donde se verificará la existencia del atributo.
   * @returns {boolean} - Retorna true si el atributo ya existe, de lo contrario, retorna false.
   */
  async isAttributeCreated(): Promise<boolean> {
    const targetAttributeKey = "funciones_del_bot";

    const response = await this._request(`/custom_attribute_definitions`, {
      method: "GET",
    });

    if (response && response.length > 0) {
      for (const attribute of response) {
        if (attribute.attribute_key === targetAttributeKey) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Crea un nuevo atributo personalizado en la cuenta especificada.
   *
   * El atributo creado se denomina "Funciones del Bot" y es de tipo lista con
   * los valores "On" y "Off". Está destinado a actuar como un control para
   * las funciones del bot.
   *
   * @param {integer} account_id - El ID numérico de la cuenta donde se creará el atributo.
   * @returns {object} - Retorna la respuesta del servidor, que puede incluir detalles del atributo creado.
   */
  async createAttributes(): Promise<any> {
    const data: AttributeDefinition = {
      attribute_display_name: "Funciones del Bot", // Nombre visible del atributo.
      attribute_display_type: 6, // Tipo de visualización: Lista.
      attribute_description: "Desactiva el chatbot a un cliente", // Descripción del atributo.
      attribute_key: "funciones_del_bot", // Clave única para el atributo.
      attribute_values: ["ON", "OFF"], // Posibles valores para el atributo.
      attribute_model: 1, // Tipo de modelo: Contacto.
    };

    const response = await this._request(`/custom_attribute_definitions`, {
      method: "POST",
      data: data,
    });

    return response;
  }

  /**
   * Crea un nuevo contacto en Chatwoot.
   * @param {string} name - Nombre del contacto.
   * @param {string} phoneNumber - Número de teléfono del contacto.
   */
  async createContact(name: string, phoneNumber: string): Promise<number> {
    const formattedPhoneNumber = phoneNumber.startsWith("+")
      ? phoneNumber
      : `+${phoneNumber}`;

    const data = {
      inbox_id: this.CHATWOOT_INBOX_ID,
      name: name,
      phone_number: formattedPhoneNumber,
    };

    const response = await this._request(`/contacts`, {
      method: "POST",
      data: data,
    });

    return response.payload.contact.id;
  }

  /**
   * Crea una nueva conversación en Chatwoot para un usuario específico.
   * @param {string} sourceID - El ID de fuente único para la conversación.
   * @param {string} contactID - El ID del contacto para el cual se crea la conversación.
   * @returns {number} Retorna el ID de la conversación creada.
   */
  async createNewConversation(
    sourceID: string,
    contactID: number
  ): Promise<number> {
    const data = {
      source_id: sourceID,
      inbox_id: this.CHATWOOT_INBOX_ID,
      contact_id: contactID,
      status: "open",
      assignee_id: this.CHATWOOT_ID,
    };

    const response = await this._request(`/conversations`, {
      method: "POST",
      data: data,
    });

    return response.id;
  }

  /**
   * Valida al usuario y realiza las siguientes acciones:
   * - Obtiene el ID del usuario a partir del número de teléfono.
   * - Si no existe un ID de usuario, crea un nuevo contacto con el nombre y número de teléfono proporcionados.
   * - Obtiene los atributos del usuario a partir del número de teléfono.
   * - Si no existen atributos para el usuario, crea un nuevo atributo llamado "funciones_del_bot" con el valor "ON".
   * - Obtiene el ID de la conversación del usuario a partir del ID de usuario.
   * - Si no existe un ID de conversación, crea una nueva conversación con el ID de origen y el ID de usuario proporcionados.
   *
   * @param userPhone El número de teléfono del usuario.
   * @param name El nombre del usuario.
   * @returns Un objeto que contiene el ID del usuario y el ID de la conversación.
   * @throws Error si ocurre un error al crear el atributo personalizado.
   */
  async ValidateUser(userPhone: string, name: string): Promise<any> {
    let userID = await this.getUserID(userPhone);
    if (!userID) {
      userID = await this.createContact(name, userPhone);
      await new Promise((r) => setTimeout(r, 100));
      const getAttributes = await this.getAttributes(userPhone);
      if (!getAttributes) {
        const result = await this.setAttributes(
          userPhone,
          "funciones_del_bot",
          "ON"
        );
        if (result) {
          console.log("Atributo actualizado con éxito.");
        }
      }
    }

    let conversation_id = await this.getConversationID(userID);
    if (!conversation_id) {
      // Adquiere el bloqueo
      if (Chatwoot_Client.locks[userPhone]) {
        while (Chatwoot_Client.locks[userPhone]) {
          await new Promise((r) => setTimeout(r, 100));
        }
        conversation_id = await this.getConversationID(userID);
      } else {
        Chatwoot_Client.locks[userPhone] = true;

        const sourceID = `ChatBot ${userPhone}`; // Aquí, debes decidir cómo determinar el 'sourceID'. Podría ser el userID u otro valor único.
        conversation_id = await this.createNewConversation(sourceID, userID);
        Chatwoot_Client.locks[userPhone] = false;
      }
    }
    return conversation_id;
  }

  /**
   * Maneja los datos de los medios.
   *
   * @param MediaData - Los datos de los medios.
   * @param form - El objeto FormData utilizado para enviar los datos.
   * @returns Una promesa que se resuelve cuando se han manejado los datos de los medios.
   */
  async handleMediaData(MediaData: MediaData, form: FormData): Promise<void> {
    try {
      for (const typeKey in MediaData.message) {
        const mediaType = MediaData.message[typeKey];
        if (!mediaType || !mediaType.mimetype) {
          continue;
        }
        const { caption, mimetype, filename } = mediaType;

        // Suponiendo que saveFile devuelve la ruta del archivo guardado
        const filePath = await this.provider.saveFile(MediaData);
        console.log("File path:", filePath);
        const safeFilename = filename || `file.${mimetype.split("/")[1]}`;

        const stream = await fs.createReadStream(filePath);
        // Asegurarse de que el archivo existe antes de intentar usarlo
        if (fs.existsSync(filePath)) {
          form.append("attachments[]", stream, {
            filename: safeFilename,
            contentType: mimetype,
          });

          if (caption) {
            form.append("content", caption);
          }
        } else {
          console.error("File does not exist:", filePath);
        }
      }
    } catch (error) {
      console.error("Error handling media data:", error);
    }
  }

  /**
   * Descarga un archivo de medios desde la URL proporcionada.
   * @param mediaUrl La URL del archivo de medios a descargar.
   * @returns Una promesa que se resuelve con los datos del archivo descargado y su tipo de contenido, o null si ocurre un error.
   */
  async _downloadMedia(mediaUrl: string): Promise<any> {
    try {
      const response = await axios.get(mediaUrl, {
        responseType: "stream",
      });
      return {
        data: response.data,
        contentType: response.headers["content-type"],
      };
    } catch (error) {
      console.error("Error downloading media:", error);
      return null; // O maneja el error de otra manera
    }
  }

  /**
   * Maneja la descarga y adjuntado de archivos de medios desde una URL o una ruta de archivo local.
   *
   * @param url - La URL del archivo de medios o la ruta de archivo local.
   * @param form - El objeto FormData al que se adjuntará el archivo descargado.
   * @returns Una promesa que se resuelve cuando se completa el proceso de manejo del archivo.
   * @throws Si ocurre algún error durante el proceso de manejo del archivo.
   */
  async handleURLMedia(url: string, form: FormData): Promise<void> {
    try {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        const { data, contentType } = await this._downloadMedia(url);
        if (data && contentType) {
          const fileName = this.extractFileName(url, contentType);
          console.log("File name:", fileName);
          form.append("attachments[]", data, {
            filename: fileName,
          });
        } else {
          console.error("Failed to download or invalid content type:", url);
        }
      } else if (fs.existsSync(url)) {
        const fileName = url.substring(url.lastIndexOf("/"));
        const stream = fs.createReadStream(url);
        form.append("attachments[]", stream, {
          filename: fileName,
        });
      } else {
        console.warn(
          "The URL does not start with http or https and is not a valid file path:",
          url
        );
      }
    } catch (error) {
      console.error("Error handling URL media:", error);
    }
  }

  private extractFileName(url: string, contentType: string): string {
    // Extracts a file name from the URL or creates a generic one based on content type
    const urlParts = url.split("/");
    const lastSegment = urlParts[urlParts.length - 1];
    if (lastSegment && lastSegment.includes(".")) {
      return lastSegment; // Use the original file name if present
    } else {
      // Create a generic file name if URL does not include one
      const extension = contentType.split("/")[1] || "bin"; // Default to 'bin' if no extension is detectable
      return `file.${extension}`;
    }
  }

  /**
   * Envía un mensaje a través del cliente de Chatwoot.
   *
   * @param userPhone El número de teléfono del usuario.
   * @param message El mensaje a enviar.
   * @param TypeUser El tipo de usuario del mensaje.
   * @param isPrivate Indica si el mensaje es privado o no.
   * @param name El nombre del usuario.
   * @returns Un valor booleano que indica si el mensaje se envió correctamente.
   */
  async sendMessage(
    userPhone: string,
    message: string,
    TypeUser: string,
    isPrivate: boolean,
    name: string
  ) {
    const conversationID = await this.ValidateUser(userPhone, name);

    const data = {
      content: message,
      message_type: TypeUser,
      private: isPrivate,
    };
    return await this._request(`/conversations/${conversationID}/messages`, {
      method: "POST",
      data: data,
    });
  }

  /**
   * Envía un mensaje con un adjunto a una conversación en Chatwoot.
   *
   * @param userPhone El número de teléfono del usuario.
   * @param message El mensaje a enviar.
   * @param media El enlace o ruta del archivo adjunto.
   * @param TypeUser El tipo de usuario que envía el mensaje.
   * @param isPrivate Indica si el mensaje es privado o no.
   * @param MediaData Los datos del archivo adjunto en formato MediaData.
   * @param name El nombre del archivo adjunto.
   * @returns Una promesa que se resuelve en `true` si el mensaje se envía correctamente.
   * @throws Error si ocurre un error al enviar el mensaje.
   */
  async sendMessageAttachment(
    userPhone: string,
    message: string,
    media: string,
    TypeUser: string,
    isPrivate: boolean,
    MediaData?: MediaData,
    name?: string
  ): Promise<boolean> {
    try {
      const conversationID = await this.ValidateUser(userPhone, name);

      const form = new FormData();
      if (message) {
        form.append("content", message);
      }

      if (MediaData) {
        await this.handleMediaData(MediaData, form);
      }
      if (media) {
        await this.handleURLMedia(media, form);
      }

      form.append("message_type", TypeUser);
      form.append("private", isPrivate.toString());

      if (name) form.append("name", name);

      return await this._request(`/conversations/${conversationID}/messages`, {
        method: "POST",
        headers: {
          ...form.getHeaders(),
          api_access_token: this.CHATWOOT_API_ACCESS_TOKEN,
        },
        data: form,
      });
    } catch (error) {
      console.error(
        "Failed to send message:",
        error.response?.data || error.message
      );
      throw error;
    }
  }
}

export { Chatwoot_Client };
