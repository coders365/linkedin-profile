import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LinkedinModule } from './linkedin/linkedin.module';

@Module({
  imports: [LinkedinModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
