import { Global, Module } from '@nestjs/common';
import { HeartbeatJob } from './heartbeat.job';
import { JobsService } from './jobs.service';

@Global()
@Module({
  providers: [JobsService, HeartbeatJob],
  exports: [JobsService, HeartbeatJob],
})
export class JobsModule {}
