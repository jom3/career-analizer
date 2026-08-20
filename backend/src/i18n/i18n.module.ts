import { Global, Module } from '@nestjs/common';

// Modulo global: expone los helpers y providers de idioma de interfaz
// a cualquier servicio sin re-importarlo.
@Global()
@Module({})
export class I18nModule {}
