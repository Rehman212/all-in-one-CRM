import { Injectable, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async onModuleInit() {
    const email = (process.env.ADMIN_EMAIL || 'hello@socialvelocityy.com').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await this.prisma.user.create({
        data: {
          email,
          name: 'Social Velocityy',
          passwordHash: await bcrypt.hash(password, 10),
        },
      });
    }
    const smtp = await this.prisma.smtpSetting.findFirst();
    if (!smtp) {
      await this.prisma.smtpSetting.create({
        data: {
          host: 'email-smtp.ap-south-1.amazonaws.com',
          port: 587,
          fromEmail: 'hello@socialvelocityy.com',
          fromName: 'Social Velocityy',
        },
      });
    }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const token = this.jwt.sign({ sub: user.id, email: user.email });
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  }
}
