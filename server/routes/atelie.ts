import { Router, Request, Response } from 'express';
import { validateBody } from '../middleware/zodValidator.js';
import {
  createAtelieSchema,
  updateAtelieSchema,
  atelieMemberSchema,
  CreateAtelieInput,
  UpdateAtelieInput,
  AtelieMemberInput,
} from '../schemas/zodSchemas.js';
import { logSecurityEvent } from '../services/auditLogger.js';

const router = Router();

/**
 * 1. Validate & Create Ateliê Profile (Clean, safe, stripped of unknown fields via Zod)
 */
router.post(
  '/',
  validateBody(createAtelieSchema),
  (req: Request, res: Response) => {
    const atelieData = req.body as CreateAtelieInput;
    const atelieId = `atelie_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newAtelie = {
      id: atelieId,
      ...atelieData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ativo: true,
    };

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';

    logSecurityEvent({
      type: 'DATA_CREATED',
      severity: 'INFO',
      ip,
      path: req.originalUrl,
      method: req.method,
      details: `Ateliê '${newAtelie.nome}' created and validated via Zod schema successfully.`,
    });

    res.status(201).json({
      success: true,
      message: 'Ateliê validado e registado com sucesso com Zod.',
      atelie: newAtelie,
    });
  }
);

/**
 * 2. Dry-Run Ateliê Validation (Safe verification before persistence via Zod)
 */
router.post(
  '/validate',
  validateBody(createAtelieSchema),
  (req: Request, res: Response) => {
    res.json({
      valido: true,
      mensagem: 'Todos os campos do Ateliê foram validados e higienizados com sucesso pelo Zod!',
      sanitizedPayload: req.body,
    });
  }
);

/**
 * 3. Update existing Ateliê
 */
router.put(
  '/:id',
  validateBody(updateAtelieSchema),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body as UpdateAtelieInput;

    res.json({
      success: true,
      message: `Ateliê '${id}' atualizado com dados validados via Zod.`,
      updatedFields: updateData,
      updatedAt: new Date().toISOString(),
    });
  }
);

/**
 * 4. Add Staff Member to Ateliê
 */
router.post(
  '/:id/members',
  validateBody(atelieMemberSchema),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const memberData = req.body as AtelieMemberInput;

    res.status(201).json({
      success: true,
      message: `Membro '${memberData.nome}' associado com sucesso ao Ateliê ${id}.`,
      member: memberData,
    });
  }
);

/**
 * 5. Return Ateliê & Auth Schema Meta-information (Zod)
 */
router.get('/schema-definition', (_req: Request, res: Response) => {
  res.json({
    engine: 'Zod v3.x / v4.x',
    schemas: {
      createAtelie: {
        fields: ['nome', 'proprietarioNome', 'email', 'telefone', 'pais', 'moeda', 'cidade', 'endereco', 'nif', 'plano', 'avatarIcon', 'whatsappConfig', 'settings'],
        required: ['nome', 'proprietarioNome', 'email', 'telefone'],
      },
      updateAtelie: {
        minFieldsRequired: 1,
      },
      authLogin: {
        fields: ['email', 'password', 'pin', 'role', 'atelieId'],
        required: ['email'],
      },
      authToken: {
        fields: ['userId', 'email', 'role', 'atelieName', 'authProvider'],
        required: ['userId'],
      },
    },
  });
});

export default router;

