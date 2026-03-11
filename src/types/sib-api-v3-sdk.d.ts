declare module 'sib-api-v3-sdk' {
  export class ApiClient {
    static instance: ApiClient;
    authentications: {
      'api-key': {
        apiKey: string;
      };
    };
  }

  export class TransactionalEmailsApi {
    sendTransacEmail(sendSmtpEmail: SendSmtpEmail): Promise<any>;
  }

  export class SendSmtpEmail {
    subject?: string;
    htmlContent?: string;
    textContent?: string;
    sender?: {
      email: string;
      name?: string;
    };
    to?: Array<{ email: string; name?: string }>;
    replyTo?: { email: string; name?: string };
    attachment?: Array<{
      content: string;
      filename: string;
      type: string;
      disposition?: string;
    }>;
    headers?: { [key: string]: string };
    tags?: string[];
  }

  export default {
    ApiClient,
    TransactionalEmailsApi,
    SendSmtpEmail
  };
}
