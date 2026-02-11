import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SecondmeService } from './secondme.service';

@Module({
  imports: [HttpModule],
  providers: [SecondmeService],
  exports: [SecondmeService],
})
export class SecondmeModule {}
