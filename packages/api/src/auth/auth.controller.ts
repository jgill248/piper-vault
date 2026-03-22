import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { RegisterSchema, LoginSchema } from './dto/auth.dto';
import type { AuthTokenResponse, AuthUserResponse } from './dto/auth.dto';
import type { UserRow } from '../database/schema';

function toUserResponse(user: UserRow): AuthUserResponse {
  return {
    id: user.id,
    username: user.username,
    email: user.email ?? undefined,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Controller for JWT-based user authentication.
 *
 * POST /api/v1/auth/register — create a new user account (always public)
 * POST /api/v1/auth/login    — exchange credentials for a JWT (always public)
 * GET  /api/v1/auth/me       — return the current authenticated user
 */
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/register
   * Creates a new user account and returns a JWT token.
   * Always public — no auth required.
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: unknown): Promise<AuthTokenResponse> {
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid registration input',
          details: parsed.error.flatten(),
        },
      });
    }

    try {
      const { user, token } = await this.authService.register(parsed.data);
      this.logger.log(`Registered new user: ${user.username} (${user.id})`);
      return { user: toUserResponse(user), token };
    } catch (err) {
      // Postgres unique violation on username
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('unique') || message.includes('duplicate') || message.includes('already exists')) {
        throw new ConflictException({
          error: {
            code: 'USERNAME_TAKEN',
            message: 'That username is already taken',
          },
        });
      }
      throw err;
    }
  }

  /**
   * POST /api/v1/auth/login
   * Validates credentials and returns a JWT token.
   * Always public — no auth required.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown): Promise<AuthTokenResponse> {
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid login input',
          details: parsed.error.flatten(),
        },
      });
    }

    const result = await this.authService.login(parsed.data);
    if (!result) {
      throw new UnauthorizedException({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        },
      });
    }

    return { user: toUserResponse(result.user), token: result.token };
  }

  /**
   * GET /api/v1/auth/me
   * Returns the current authenticated user.
   * Requires a valid JWT when auth is enabled.
   */
  @Get('me')
  getMe(@CurrentUser() user: UserRow | undefined): AuthUserResponse | null {
    if (!user) return null;
    return toUserResponse(user);
  }
}
