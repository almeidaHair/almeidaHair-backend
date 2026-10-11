import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

function fieldErrors(errors: ValidationError[]): Record<string, string> {
  const result: Record<string, string> = {};

  const visit = (error: ValidationError, parent = '') => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) {
      const key = path === 'professional.diagnosis' ? 'diagnosis' : path;
      result[key] = Object.values(error.constraints)[0];
    }
    error.children?.forEach((child) => visit(child, path));
  };

  errors.forEach((error) => visit(error));
  return result;
}

@Catch()
class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    let message = 'Ocorreu um erro inesperado.';
    let errors: Record<string, string> | undefined;
    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const body = exceptionResponse as {
        message?: string | string[];
        fieldErrors?: Record<string, string>;
      };
      message = Array.isArray(body.message)
        ? body.message[0]
        : body.message ?? message;
      errors = body.fieldErrors;
    }

    response.status(status).json({
      status,
      message,
      ...(errors ? { fieldErrors: errors } : {}),
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    origin: config
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          message: 'Revise os campos destacados.',
          fieldErrors: fieldErrors(errors),
        }),
    }),
  );

  if (config.get<boolean>('SWAGGER_ENABLED', true)) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Almeida Hair API')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }

  app.useGlobalFilters(new ApiExceptionFilter());

  await app.listen(config.get<number>('PORT', 3000), '0.0.0.0');
}

void bootstrap();
