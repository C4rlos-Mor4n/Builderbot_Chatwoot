export interface Contact {
  id: number;
  custom_attributes?: {
    funciones_del_bot?: string;
  };
}

export interface Conversation {
  conversation_id: number;
  inbox_id: number;
}

export interface AttributeDefinition {
  attribute_display_name: string;
  attribute_display_type: number;
  attribute_description: string;
  attribute_key: string;
  attribute_values: string[];
  attribute_model: number;
}

// Interfaces o tipos para TypeScript
export interface MediaData {
  message: {
    [key: string]: {
      caption?: string;
      mimetype?: string;
      filename?: string;
    };
  };
}
