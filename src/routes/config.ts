import { Router } from 'express';
import { ConfigController } from '@/controllers/ConfigController';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import { 
  createConfigSchema, 
  updateConfigSchema, 
  controlBotSchema,
  backupConfigSchema 
} from '@/validation/config.validation';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Configuration CRUD operations
router.get('/', ConfigController.getConfigs);
router.get('/templates', ConfigController.getTemplates);
router.get('/:id', ConfigController.getConfig);
router.post('/', validateRequest(createConfigSchema), ConfigController.createConfig);
router.put('/:id', validateRequest(updateConfigSchema), ConfigController.updateConfig);
router.delete('/:id', ConfigController.deleteConfig);

// Configuration validation
router.post('/validate', ConfigController.validateConfigEndpoint);

// Bot control operations
router.post('/:id/control', validateRequest(controlBotSchema), ConfigController.controlBot);
router.get('/:id/status', ConfigController.getBotStatusEndpoint);

// Configuration backup and restore
router.post('/:id/backup', validateRequest(backupConfigSchema), ConfigController.backupConfig);
router.post('/:id/restore', ConfigController.restoreConfig);

export default router;