import { Module } from '@nestjs/common';
import { SocketModule } from './socket/socket.module';
import { ConfigModule } from '@nestjs/config';
import { AudioModule } from './audio/audio.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes the .env variables available globally
    }),
    SocketModule,
    AudioModule,
  ],
})
export class AppModule {}
