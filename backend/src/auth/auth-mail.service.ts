import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

interface MailDeliveryResult {
  sent: boolean;
  developmentUrl?: string;
}

@Injectable()
export class AuthMailService {
  private readonly transporter: Transporter | null;
  private readonly from: string | undefined;
  private readonly frontendUrl: string;
  private readonly isProduction: boolean;
  private readonly enabled: boolean;

  constructor(private config: ConfigService) {
    const host = config.get<string>('MAIL_HOST');
    this.from = config.get<string>('MAIL_FROM');
    this.frontendUrl = config
      .get<string>('FRONTEND_URL', 'http://localhost:5173')
      .replace(/\/+$/, '');
    this.isProduction = config.get('NODE_ENV') === 'production';
    this.enabled = config.get('AUTH_EMAIL_ENABLED') === 'true';

    this.transporter =
      this.enabled && host && this.from
        ? nodemailer.createTransport({
            host,
            port: Number(config.get('MAIL_PORT', 587)),
            secure: config.get('MAIL_SECURE') === 'true',
            auth: config.get('MAIL_USER')
              ? {
                  user: config.getOrThrow<string>('MAIL_USER'),
                  pass: config.getOrThrow<string>('MAIL_PASSWORD'),
                }
              : undefined,
          })
        : null;
  }

  isEmailEnabled() {
    return this.enabled;
  }

  assertAvailableForPublicRegistration() {
    if (!this.enabled || (this.isProduction && !this.transporter)) {
      throw new ServiceUnavailableException(
        'El servicio de correo no está disponible en este momento. Intenta más tarde.',
      );
    }
  }

  async sendVerification(
    email: string,
    name: string,
    token: string,
  ): Promise<MailDeliveryResult> {
    const url = `${this.frontendUrl}/verificar-correo?token=${encodeURIComponent(token)}`;
    return this.send(
      email,
      'Verifica tu correo de SICAT',
      `Hola ${name}. Verifica tu correo para continuar con el registro en SICAT: ${url}\n\nEl enlace vence en 24 horas.`,
      url,
    );
  }

  async sendPasswordReset(
    email: string,
    name: string,
    token: string,
  ): Promise<MailDeliveryResult> {
    const url = `${this.frontendUrl}/restablecer-password?token=${encodeURIComponent(token)}`;
    return this.send(
      email,
      'Restablece tu contraseña de SICAT',
      `Hola ${name}. Usa este enlace para restablecer tu contraseña de SICAT: ${url}\n\nEl enlace vence en 30 minutos. Si no solicitaste el cambio, ignora este mensaje.`,
      url,
    );
  }

  private async send(
    to: string,
    subject: string,
    text: string,
    developmentUrl: string,
  ): Promise<MailDeliveryResult> {
    if (!this.transporter || !this.from) {
      return this.isProduction
        ? { sent: false }
        : { sent: false, developmentUrl };
    }

    await this.transporter.sendMail({ from: this.from, to, subject, text });
    return { sent: true };
  }
}
