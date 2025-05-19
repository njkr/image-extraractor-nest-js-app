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

enum dataType {
  screenShot = 'screenshot',
  audio = 'audio',
}
type Data = {
  text: string;
  type: dataType;
  id: string;
};

@WebSocketGateway({ cors: true })
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private openAi: ChatOpenAI;

  constructor() {
    this.openAi = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4.1-nano',
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

  @SubscribeMessage('take_screenshot')
  create() {
    this.server.emit('take_screenshot');
  }

  @SubscribeMessage('recording_event')
  async recordingEvent(@MessageBody() isRecording: boolean) {
    this.server.emit('recording_event', isRecording);
  }

  @SubscribeMessage('recording_event_client')
  async recordingEventClient(@MessageBody() isRecording: boolean) {
    this.server.emit('recording_event_client', isRecording);
  }

  @SubscribeMessage('streaming_event')
  async imageData(@MessageBody() data: Data) {
    // console.log(imageData.text);

    const { type, id, text } = data;

    // Generalize the prompt to instruct the model to return answers in markdown format
    const prompt = `
    You are a helpful assistant. The following text has been extracted from an image and contains a question.
  
    Your task is to respond in markdown format, no matter the type of question. This could include explanations, bullet points, lists, code snippets, or any other relevant format. Be sure to structure the response clearly in markdown.
  
    Question: ${text}
  
    Answer in markdown:
    `;

    try {
      // Directly invoke the model (without output parser)
      const stream = await this.openAi.stream(prompt);

      this.server.emit('stream_response', {
        question: text,
        isError: false,
        type,
        id,
        status: 'start',
        createdAt: new Date().toISOString(),
      });

      for await (const chunk of stream) {
        // Process the stream chunk
        if (chunk) {
          this.server.emit('stream_response', {
            content: chunk.content,
            isError: false,
            type,
            id,
            status: 'streaming',
            date: new Date().toISOString(),
          });
        }
      }

      this.server.emit('stream_response', {
        isError: false,
        type,
        id,
        status: 'end',
        date: new Date().toISOString(),
      });
    } catch (error) {
      this.server.emit('stream_response', {
        content: error.message,
        isError: true,
        type,
        id,
        status: 'end',
        date: new Date().toISOString(),
      });
      console.error('Error invoking LangChain model:', error);
    }
  }
}
