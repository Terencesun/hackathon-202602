import { Module } from '@nestjs/common';
import { BrokerBindingsService } from './broker-bindings.service';

@Module({
  providers: [BrokerBindingsService],
  exports: [BrokerBindingsService],
})
export class BrokerBindingsModule {}
