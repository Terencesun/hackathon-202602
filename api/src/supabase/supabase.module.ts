import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from './supabase.constants';

@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): SupabaseClient => {
        const nodeEnv =
          configService.get<string>('NODE_ENV') ?? process.env.NODE_ENV;
        if (nodeEnv === 'test') {
          return {} as SupabaseClient;
        }

        const url = configService.get<string>('SUPABASE_URL');
        if (!url || !/^https?:\/\//.test(url)) {
          throw new Error('SUPABASE_URL must be a valid HTTP/HTTPS URL');
        }

        const key =
          configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
          configService.get<string>('SUPABASE_ANON_KEY');
        if (!key) {
          throw new Error(
            'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required',
          );
        }

        const client = createClient(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });
        return client;
      },
    },
  ],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
