import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { improveDescriptionLocally } from '../domain/description.js';
import { DescriptionAiService } from '../infrastructure/description-ai.js';
import {
  AuthorizedRequest,
  requireContext,
  TenantGuard,
} from './tenant.guard.js';

@Controller('api/ai')
@UseGuards(TenantGuard)
export class AiController {
  constructor(private readonly ai: DescriptionAiService) {}

  @Post('improve-description')
  async improve(@Req() request: AuthorizedRequest, @Body() body: unknown) {
    const { roles } = requireContext(request);
    if (
      ![...roles].some((role) =>
        ['Admin', 'Project Manager', 'Team Member'].includes(role),
      )
    )
      throw new ForbiddenException();
    if (!body || typeof body !== 'object')
      throw new BadRequestException('Text is required.');
    const text = (body as Record<string, unknown>).text;
    if (typeof text !== 'string' || !text.trim() || text.length > 4000)
      throw new BadRequestException('Text must contain 1 to 4000 characters.');
    const remote = await this.ai.improve(text);
    return {
      original: text,
      improved: remote ?? improveDescriptionLocally(text),
      summary: remote
        ? 'Using GitHub Models AI to enhance clarity and actionability of task descriptions.'
        : 'Using an internal grammar and clarity pass to make the task actionable and easier to execute.',
    };
  }
}
