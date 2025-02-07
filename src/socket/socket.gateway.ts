import { ChatOpenAI } from '@langchain/openai';
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { isError } from 'util';

type ImageData = {
  text: string;
};

@WebSocketGateway({ cors: true })
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private openAiModel: ChatOpenAI;

  constructor() {
    this.openAiModel = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
      temperature: 0,
    });
  }

  getServer(): Server {
    return this.server;
  }

  afterInit() {
    console.log('socket init');
  }
  handleConnection(client: Socket) {
    console.log('client connected' + client.id);
  }
  handleDisconnect(client: Socket) {
    console.log('client disconnected' + client.id);
  }

  @SubscribeMessage('get_answer')
  create() {
    this.server.emit('take_screenshot', 'test_socket');
  }

  @SubscribeMessage('image_data_listener')
  async imageData(@MessageBody() imageData: ImageData) {
    // console.log(imageData.text);

    // Generalize the prompt to instruct the model to return answers in markdown format
    const prompt = `
    You are a helpful assistant. The following text has been extracted from an image and contains a question.
  
    Your task is to respond in markdown format, no matter the type of question. This could include explanations, bullet points, lists, code snippets, or any other relevant format. Be sure to structure the response clearly in markdown.
  
    Question: ${imageData.text}
  
    Answer in markdown:
    `;

    try {
      // Directly invoke the model (without output parser)
      const result = await this.openAiModel.invoke(prompt);

      // Extract the raw markdown response from the result
      const markdownResponse = result.content; // The raw markdown response

      // Log and return the result
      this.server.emit('markdown_response', {
        markdownResponse,
        isError: false,
      });
    } catch (error) {
      this.server.emit('markdown_response', {
        markdownResponse: error.message,
        isError: false,
      });
      console.error('Error invoking LangChain model:', error);
    }
  }
}
