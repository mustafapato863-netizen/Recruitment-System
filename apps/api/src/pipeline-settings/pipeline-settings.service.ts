import { Injectable, NotFoundException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { CreatePipelineTemplateDto, CreatePipelineStageDto, UpdatePipelineStageDto, ReorderStagesDto } from './pipeline-settings.dto';
import type { PipelineTemplateItem } from '@recruitflow/contracts';

@Injectable()
export class PipelineSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTemplates(organizationId: string): Promise<PipelineTemplateItem[]> {
    const templates = await this.prisma.pipelineTemplate.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { stages: true }
        }
      }
    });

    // Pipeline templates are not related to vacancies in the current schema.
    // Return null so the UI can distinguish unavailable data from a real zero.
    return templates.map(t => ({
      id: t.id,
      name: t.name,
      isDefault: t.isDefault,
      status: t.status,
      stageCount: t._count.stages,
      vacancyCount: null,
    }));
  }

  async getTemplate(organizationId: string, id: string) {
    const template = await this.prisma.pipelineTemplate.findFirst({
      where: { id, organizationId },
      include: {
        stages: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async createTemplate(organizationId: string, dto: CreatePipelineTemplateDto) {
    return this.prisma.pipelineTemplate.create({
      data: {
        organizationId,
        name: dto.name,
        isDefault: dto.isDefault ?? false,
      }
    });
  }

  async duplicateTemplate(organizationId: string, id: string) {
    const template = await this.prisma.pipelineTemplate.findFirst({
      where: { id, organizationId },
      include: { stages: true }
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return this.prisma.pipelineTemplate.create({
      data: {
        organizationId,
        name: `${template.name} (Copy)`,
        isDefault: false,
        stages: {
          create: template.stages.map(stage => ({
            name: stage.name,
            stageType: stage.stageType,
            sortOrder: stage.sortOrder,
            slaDays: stage.slaDays,
            defaultOwner: stage.defaultOwner,
            entryGate: stage.entryGate,
            exitGate: stage.exitGate,
            status: stage.status
          }))
        }
      }
    });
  }

  async addStage(organizationId: string, templateId: string, dto: CreatePipelineStageDto) {
    // Check if template belongs to organization
    const template = await this.prisma.pipelineTemplate.findFirst({
      where: { id: templateId, organizationId }
    });
    if (!template) throw new NotFoundException('Template not found');

    const maxSort = await this.prisma.pipelineStage.findFirst({
      where: { templateId },
      orderBy: { sortOrder: 'desc' }
    });
    const nextSort = dto.sortOrder ?? ((maxSort?.sortOrder ?? -1) + 1);

    return this.prisma.pipelineStage.create({
      data: {
        templateId,
        name: dto.name,
        stageType: dto.stageType,
        sortOrder: nextSort,
        slaDays: dto.slaDays ?? null,
        defaultOwner: dto.defaultOwner ?? null,
        entryGate: dto.entryGate ?? null,
        exitGate: dto.exitGate ?? null,
      }
    });
  }

  async reorderStages(organizationId: string, templateId: string, dto: ReorderStagesDto) {
    const template = await this.prisma.pipelineTemplate.findFirst({
      where: { id: templateId, organizationId }
    });
    if (!template) throw new NotFoundException('Template not found');

    const updates = dto.stageIds.map((id, index) =>
      this.prisma.pipelineStage.update({
        where: { id, templateId },
        data: { sortOrder: index }
      })
    );

    return this.prisma.$transaction(updates);
  }

  async updateStage(organizationId: string, templateId: string, stageId: string, dto: UpdatePipelineStageDto) {
    const template = await this.prisma.pipelineTemplate.findFirst({
      where: { id: templateId, organizationId }
    });
    if (!template) throw new NotFoundException('Template not found');

    return this.prisma.pipelineStage.update({
      where: { id: stageId, templateId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.stageType !== undefined && { stageType: dto.stageType }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.slaDays !== undefined && { slaDays: dto.slaDays }),
        ...(dto.defaultOwner !== undefined && { defaultOwner: dto.defaultOwner }),
        ...(dto.entryGate !== undefined && { entryGate: dto.entryGate }),
        ...(dto.exitGate !== undefined && { exitGate: dto.exitGate }),
      }
    });
  }

  async deleteStage(organizationId: string, templateId: string, stageId: string) {
    const template = await this.prisma.pipelineTemplate.findFirst({
      where: { id: templateId, organizationId }
    });
    if (!template) throw new NotFoundException('Template not found');

    return this.prisma.pipelineStage.delete({
      where: { id: stageId, templateId }
    });
  }
}
